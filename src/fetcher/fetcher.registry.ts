import { injectable } from 'inversify';
import { IFetcher } from '../interfaces/fetcher.interface';

@injectable()
export class FetcherRegistry {
  private fetchers: IFetcher[] = [];

  register(fetcher: IFetcher): void {
    this.fetchers.push(fetcher);
    // Sort by priority (higher priority first)
    this.fetchers.sort((a, b) => b.priority - a.priority);
  }

  getFetcher(url: string): IFetcher | null {
    for (const fetcher of this.fetchers) {
      if (fetcher.supports(url)) {
        return fetcher;
      }
    }
    return null;
  }

  getAllFetchers(): IFetcher[] {
    return [...this.fetchers];
  }
}
