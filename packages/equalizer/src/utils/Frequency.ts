export class Frequency {
  public constructor(private __val: number) {
    if (typeof __val !== 'number' || isNaN(__val) || __val === Infinity)
      throw new TypeError('Frequency value must be a number');
    if (this.__val < 0)
      throw new Error(`Frequency value cannot be negative (${__val})`);
  }

  public khz() {
    return this.__val * 1000.0;
  }

  public mhz() {
    return this.__val * 1_000_000.0;
  }

  public hz() {
    return this.__val;
  }

  public dt() {
    return 1.0 / this.__val;
  }

  public valueOf() {
    return this.__val;
  }

  public toString() {
    return `${this.__val}Hz`;
  }

  public toJSON() {
    return this.toString();
  }
}
