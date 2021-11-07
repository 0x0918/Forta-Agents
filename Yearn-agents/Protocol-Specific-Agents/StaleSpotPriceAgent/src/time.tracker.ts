export default class TimeTracker {
  private hour: number; // keeps track of the hour
  private firstHour: number;
  functionWasCalled: boolean;
  findingReported: boolean;

  constructor() {
    this.hour = -1;
    this.firstHour = -1;
    this.functionWasCalled = false;
    this.findingReported = false;
  }

  isOutOf3Hours(timestamp: number): boolean {
    if (this.hour === -1) {
      return false;
    }

    return this.getHour(timestamp) - this.hour >= 3;
  }

  updateFunctionWasCalled(status: boolean): void {
    this.functionWasCalled = status;
  }

  updateFindingReport(status: boolean): void {
    this.findingReported = status;
  }

  getHour(timestamp: number): number {
    const nd = new Date(timestamp * 1000); //x1000 to convert from seconds to milliseconds
    return nd.getUTCHours();
  }

  isIn3Hours(timestamp: number): boolean {
    const hour = this.getHour(timestamp);
    return hour - this.hour < 3;
  }

  isFirstHour(timestamp: number): boolean {
    return this.firstHour === -1 || this.firstHour === this.getHour(timestamp);
  }

  updateHour(timestamp: number): void {
    if (this.hour === -1) {
      this.firstHour = this.getHour(timestamp);
    }
    this.hour = this.getHour(timestamp);
  }
}
