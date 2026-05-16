#!/usr/bin/env python3
import json
import sys
from collections import defaultdict


def overlaps(a_start, a_end, b_start, b_end):
    def minutes(value):
        hour, minute = str(value).split(":")[:2]
        return int(hour) * 60 + int(minute)

    return minutes(a_start) < minutes(b_end) and minutes(b_start) < minutes(a_end)


def gap_minutes(left, right):
    def minutes(value):
        hour, minute = str(value).split(":")[:2]
        return int(hour) * 60 + int(minute)

    return min(
        abs(minutes(left["startTime"]) - minutes(right["endTime"])),
        abs(minutes(right["startTime"]) - minutes(left["endTime"])),
    )


def add_no_overlap_constraints(model, decision, options, resource_key):
    buckets = defaultdict(list)
    for option in options:
        for resource_id in option[resource_key]:
            buckets[(resource_id, option["date"])].append(option)

    constrained_pairs = set()
    for bucket_options in buckets.values():
        if len(bucket_options) < 2:
            continue
        for index, left in enumerate(bucket_options):
            for right in bucket_options[index + 1 :]:
                if not overlaps(left["startTime"], left["endTime"], right["startTime"], right["endTime"]):
                    continue
                pair = tuple(sorted((left["id"], right["id"])))
                if pair in constrained_pairs:
                    continue
                constrained_pairs.add(pair)
                model.Add(decision[left["id"]] + decision[right["id"]] <= 1)


def solve(payload):
    try:
        from ortools.sat.python import cp_model
    except Exception as exc:
        return {
            "status": "ERROR",
            "errorCode": "ORTOOLS_NOT_INSTALLED",
            "message": f"Python OR-Tools bulunamadı: {exc}. Kurulum için `python3 -m pip install -r requirements.txt` çalıştırın.",
        }

    options = payload.get("options", [])
    exams = payload.get("exams", [])
    invigilators = payload.get("invigilators", [])
    if not options:
        return {"status": "INFEASIBLE", "diagnostics": [{"type": "NO_OPTIONS", "message": "CP-SAT için aday seçenek yok."}]}

    model = cp_model.CpModel()
    decision = {option["id"]: model.NewBoolVar(option["id"]) for option in options}
    options_by_exam = defaultdict(list)
    options_by_invigilator = defaultdict(list)
    options_by_invigilator_date = defaultdict(list)
    for option in options:
        for exam_id in option["examIds"]:
            options_by_exam[exam_id].append(option)
        for invigilator_id in option["invigilatorIds"]:
            options_by_invigilator[invigilator_id].append(option)
            options_by_invigilator_date[(invigilator_id, option["date"])].append(option)

    for exam in exams:
        exam_options = [decision[option["id"]] for option in options_by_exam[exam["id"]]]
        if not exam_options:
            return {
                "status": "INFEASIBLE",
                "diagnostics": [{"type": "EXAM_HAS_NO_OPTIONS", "message": f"{exam.get('courseCode') or exam['id']} için aday seçenek yok.", "examId": exam["id"]}],
            }
        model.Add(sum(exam_options) == 1)

    add_no_overlap_constraints(model, decision, options, "roomIds")
    add_no_overlap_constraints(model, decision, options, "studentIds")
    add_no_overlap_constraints(model, decision, options, "invigilatorIds")

    for invigilator in invigilators:
        assigned = [decision[option["id"]] for option in options_by_invigilator[invigilator["id"]]]
        if assigned:
            model.Add(sum(assigned) <= int(invigilator.get("maxAssignments") or 9999))
        if invigilator.get("maxPerDay") is not None:
            for date in sorted({option["date"] for option in options}):
                daily = [decision[option["id"]] for option in options_by_invigilator_date[(invigilator["id"], date)]]
                if daily:
                    model.Add(sum(daily) <= int(invigilator["maxPerDay"]))

    date_indexes = sorted({int(option["dateIndex"]) for option in options})
    slot_indexes = sorted({int(option["slotIndex"]) for option in options})
    max_date = model.NewIntVar(0, max(date_indexes) if date_indexes else 0, "max_date_index")
    max_slot = model.NewIntVar(0, max(slot_indexes) if slot_indexes else 0, "max_slot_index")
    day_used = {idx: model.NewBoolVar(f"day_used_{idx}") for idx in date_indexes}

    for option in options:
        x = decision[option["id"]]
        model.Add(max_date >= int(option["dateIndex"])).OnlyEnforceIf(x)
        model.Add(max_slot >= int(option["slotIndex"])).OnlyEnforceIf(x)
        model.Add(day_used[int(option["dateIndex"])] >= x)

    option_cost = []
    for option in options:
        utilization = int(option.get("utilizationPercent", 0))
        low_utilization_penalty = max(0, 70 - utilization) * 35
        cost = (
            int(option.get("roomWaste", 0)) * 90
            + low_utilization_penalty
            + int(option.get("roomCount", 1)) * 220
            + int(option.get("roomScore", 0))
            + int(option.get("invigilatorScore", 0))
        )
        if option.get("mixed"):
            cost -= 120
        option_cost.append(cost * decision[option["id"]])

    pair_penalties = defaultdict(int)
    student_date_buckets = defaultdict(list)
    for option in options:
        for student_id in option["studentIds"]:
            student_date_buckets[(student_id, option["date"])].append(option)

    for bucket_options in student_date_buckets.values():
        if len(bucket_options) < 2:
            continue
        for index, left in enumerate(bucket_options):
            for right in bucket_options[index + 1 :]:
                pair = tuple(sorted((left["id"], right["id"])))
                pair_penalties[pair] += 320
                if not overlaps(left["startTime"], left["endTime"], right["startTime"], right["endTime"]) and gap_minutes(left, right) < 30:
                    pair_penalties[pair] += 180

    student_load_cost = []
    for (left_id, right_id), penalty in pair_penalties.items():
        both = model.NewBoolVar(f"same_day_{left_id}_{right_id}")
        model.AddBoolAnd([decision[left_id], decision[right_id]]).OnlyEnforceIf(both)
        model.AddBoolOr([decision[left_id].Not(), decision[right_id].Not(), both])
        student_load_cost.append(penalty * both)

    load_vars = []
    max_load = model.NewIntVar(0, len(exams), "max_invigilator_load")
    min_load = model.NewIntVar(0, len(exams), "min_invigilator_load")
    for invigilator in invigilators:
        assigned = [decision[option["id"]] for option in options_by_invigilator[invigilator["id"]]]
        load = model.NewIntVar(0, len(exams), f"load_{invigilator['id']}")
        if assigned:
            model.Add(load == sum(assigned))
        else:
            model.Add(load == 0)
        model.Add(max_load >= load)
        model.Add(min_load <= load)
        load_vars.append(load)

    model.Minimize(
        max_date * 1_000_000
        + sum(day_used.values()) * 500_000
        + max_slot * 100_000
        + sum(option_cost)
        + sum(student_load_cost)
        + (max_load - min_load) * 1200
    )

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = float(payload.get("solver", {}).get("timeoutSeconds") or 20)
    solver.parameters.num_search_workers = 8
    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {
            "status": "INFEASIBLE",
            "diagnostics": [{"type": "CP_SAT_INFEASIBLE", "message": "Tanımlı hard kısıtlar altında geçerli sınav planı bulunamadı."}],
        }

    return {
        "status": "OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE",
        "objectiveValue": solver.ObjectiveValue(),
        "selectedOptionIds": [option["id"] for option in options if solver.BooleanValue(decision[option["id"]])],
    }


def main():
    try:
        payload = json.load(sys.stdin)
        print(json.dumps(solve(payload), ensure_ascii=False))
    except Exception as exc:
        print(json.dumps({"status": "ERROR", "errorCode": "WORKER_FAILURE", "message": str(exc)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
