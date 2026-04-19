export type SeatStatus = 'Aktif' | 'Pasif' | 'Boşluk';

export type ClassroomSeat = {
  siraNo: string;
  satir: number;
  sutun: number;
  durum: SeatStatus;
  kapasite: number;
};

export type ClassroomLayoutPlan = {
  satirSayisi: number;
  sutunSayisi: number;
  siralar: ClassroomSeat[];
};

export type ClassroomLayoutStats = {
  toplamKapasite: number;
  aktifSira: number;
  pasifSira: number;
  boslukSayisi: number;
};

const DEFAULT_SEAT_CAPACITY = 1;

export function getSeatLabel(satir: number, sutun: number) {
  return `${String.fromCharCode(64 + satir)}${sutun}`;
}

export function createClassroomLayout(satirSayisi: number, sutunSayisi: number): ClassroomLayoutPlan {
  return {
    satirSayisi,
    sutunSayisi,
    siralar: Array.from({ length: satirSayisi }, (_, satirIndex) =>
      Array.from({ length: sutunSayisi }, (_, sutunIndex) => {
        const satir = satirIndex + 1;
        const sutun = sutunIndex + 1;

        return {
          siraNo: getSeatLabel(satir, sutun),
          satir,
          sutun,
          durum: 'Aktif' as SeatStatus,
          kapasite: DEFAULT_SEAT_CAPACITY,
        };
      }),
    ).flat(),
  };
}

export function normalizeClassroomLayout(layout: ClassroomLayoutPlan): ClassroomLayoutPlan {
  const existingSeats = new Map(
    layout.siralar.map((seat) => [`${seat.satir}-${seat.sutun}`, seat]),
  );

  return {
    satirSayisi: layout.satirSayisi,
    sutunSayisi: layout.sutunSayisi,
    siralar: Array.from({ length: layout.satirSayisi }, (_, satirIndex) =>
      Array.from({ length: layout.sutunSayisi }, (_, sutunIndex) => {
        const satir = satirIndex + 1;
        const sutun = sutunIndex + 1;
        const existingSeat = existingSeats.get(`${satir}-${sutun}`);

        return {
          siraNo: getSeatLabel(satir, sutun),
          satir,
          sutun,
          durum: existingSeat?.durum ?? 'Aktif',
          kapasite: existingSeat?.kapasite ?? DEFAULT_SEAT_CAPACITY,
        };
      }),
    ).flat(),
  };
}

export function buildLayoutMatrix(layout: ClassroomLayoutPlan) {
  return Array.from({ length: layout.satirSayisi }, (_, satirIndex) =>
    Array.from({ length: layout.sutunSayisi }, (_, sutunIndex) => {
      const satir = satirIndex + 1;
      const sutun = sutunIndex + 1;

      return (
        layout.siralar.find((seat) => seat.satir === satir && seat.sutun === sutun) ?? {
          siraNo: getSeatLabel(satir, sutun),
          satir,
          sutun,
          durum: 'Boşluk' as SeatStatus,
          kapasite: DEFAULT_SEAT_CAPACITY,
        }
      );
    }),
  );
}

export function getLayoutStats(layout: ClassroomLayoutPlan): ClassroomLayoutStats {
  return layout.siralar.reduce(
    (stats, seat) => {
      if (seat.durum === 'Aktif') {
        stats.aktifSira += 1;
        stats.toplamKapasite += seat.kapasite;
      } else if (seat.durum === 'Pasif') {
        stats.pasifSira += 1;
      } else {
        stats.boslukSayisi += 1;
      }

      return stats;
    },
    {
      toplamKapasite: 0,
      aktifSira: 0,
      pasifSira: 0,
      boslukSayisi: 0,
    } satisfies ClassroomLayoutStats,
  );
}

export function cycleSeatStatus(currentStatus: SeatStatus): SeatStatus {
  if (currentStatus === 'Aktif') return 'Boşluk';
  if (currentStatus === 'Boşluk') return 'Pasif';
  return 'Aktif';
}

export function resizeClassroomLayout(
  layout: ClassroomLayoutPlan,
  satirSayisi: number,
  sutunSayisi: number,
) {
  return normalizeClassroomLayout({
    satirSayisi,
    sutunSayisi,
    siralar: layout.siralar.filter(
      (seat) => seat.satir <= satirSayisi && seat.sutun <= sutunSayisi,
    ),
  });
}
