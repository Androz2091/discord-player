export class EqualizerConfiguration {
  public constructor(public bandMultipliers: number[]) {}

  public setGain(band: number, value: number) {
    if (this.isValidBand(band)) {
      this.bandMultipliers[band] = Math.max(Math.min(value, 1.0), -0.25);
    }
  }

  public getGain(band: number) {
    if (this.isValidBand(band)) {
      return this.bandMultipliers[band];
    } else {
      return 0.0;
    }
  }

  public isValidBand(band: number) {
    return band >= 0 && band < this.bandMultipliers.length;
  }
}
