export class EqualizerCoefficients {
  public constructor(
    public beta: number,
    public alpha: number,
    public gamma: number,
  ) {}

  public setBeta(v: number) {
    this.beta = v;
  }

  public setAlpha(v: number) {
    this.alpha = v;
  }

  public setGamma(v: number) {
    this.gamma = v;
  }

  public toJSON() {
    const { alpha, beta, gamma } = this;

    return { alpha, beta, gamma };
  }
}
