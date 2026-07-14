// Cálculos numerológicos universales (portado de WEB-NUME: resources/universal.ts + utils.ts).
// Usado por el TopBar de "Energía Colectiva" para día/semana/mes.

export function reduceNumber(number: number): number {
  let reduceSum = number;
  while (reduceSum > 9 && !(reduceSum === 22 || reduceSum === 11)) {
    reduceSum = reduceSum
      .toString()
      .split('')
      .reduce((r, c) => r + Number(c), 0);
  }
  return reduceSum;
}

export type SplittedDate = { day: number; month: number; year: number };

function isNil(value: unknown): boolean {
  return value === null || value === undefined;
}

export class Universal {
  NOW: Date;

  constructor() {
    this.NOW = new Date();
  }

  calcUniversalYear(year?: number): number {
    const yearToCalculate = isNil(year) ? this.NOW.getFullYear() : (year as number);
    return reduceNumber(yearToCalculate);
  }

  calcUniversalDay(opts: SplittedDate): number {
    const monthToCalculate = isNil(opts?.month) ? this.NOW.getMonth() + 1 : opts.month;
    const dayToCalculate = isNil(opts?.day) ? this.NOW.getDate() : opts.day;
    const yearToCalculate = isNil(opts?.year) ? this.NOW.getFullYear() : opts.year;
    return reduceNumber(this.calcUniversalYear(yearToCalculate) + monthToCalculate + dayToCalculate);
  }

  calcCurrentUniversalWeek(opts: SplittedDate): number {
    const monthToCalculate = isNil(opts?.month) ? this.NOW.getMonth() + 1 : opts.month;
    const dayToCalculate = isNil(opts?.day) ? this.NOW.getDate() : opts.day;
    const yearToCalculate = isNil(opts?.year) ? this.NOW.getFullYear() : opts.year;
    const sumUniversalWeekOne = reduceNumber(reduceNumber(yearToCalculate) + reduceNumber(monthToCalculate));
    if (dayToCalculate >= 1 && dayToCalculate <= 7) {
      return sumUniversalWeekOne;
    }
    const sumUniversalWeekTwo = reduceNumber(reduceNumber(yearToCalculate) + sumUniversalWeekOne);
    if (dayToCalculate >= 8 && dayToCalculate <= 14) {
      return sumUniversalWeekTwo;
    }
    const sumUniversalWeekThree = reduceNumber(sumUniversalWeekTwo + sumUniversalWeekOne);
    if (dayToCalculate >= 15 && dayToCalculate <= 21) {
      return sumUniversalWeekThree;
    }
    return reduceNumber(reduceNumber(monthToCalculate) + sumUniversalWeekOne);
  }

  calcUniversalMonth(opts: SplittedDate): number {
    return reduceNumber(this.calcUniversalYear(opts.year) + opts.month);
  }
}

export default Universal;
