/** Health no persiste datos; repository como punto de extensión. */
export class HealthRepository {
  async ping(): Promise<boolean> {
    return true;
  }
}
