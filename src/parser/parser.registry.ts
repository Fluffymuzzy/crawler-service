import { injectable } from 'inversify';
import { IParser } from '../interfaces/parser.interface';

@injectable()
export class ParserRegistry {
  private parsers: IParser[] = [];

  register(parser: IParser): void {
    this.parsers.push(parser);
    // Sort by priority (higher priority first)
    this.parsers.sort((a, b) => b.priority - a.priority);
  }

  getParser(url: string): IParser | null {
    for (const parser of this.parsers) {
      if (parser.supports(url)) {
        return parser;
      }
    }
    return null;
  }

  getAllParsers(): IParser[] {
    return [...this.parsers];
  }
}
