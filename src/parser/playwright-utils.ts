import type { FetchResult, ParsedProfile } from './types';
import { logger } from '../utils/logger';

const MIN_HTML_SIZE = 1000;
const JS_INDICATORS = [
  'enable javascript',
  'javascript is required',
  'javascript must be enabled',
  'checking your browser',
  'please wait',
  'loading...',
  '<div id="app"></div>',
  '<div id="root"></div>',
  'window.__INITIAL_STATE__',
  'React.createElement',
  'angular.module',
];

export function shouldUsePlaywright(
  fetchResult: FetchResult,
  parsedProfile: ParsedProfile | null,
): boolean {
  // If HTTP request failed or was blocked, don't try Playwright
  if (fetchResult.statusCode !== 200 || !fetchResult.html) {
    return false;
  }

  // Check if HTML is suspiciously small
  if (fetchResult.html.length < MIN_HTML_SIZE) {
    logger.debug(
      { htmlSize: fetchResult.html.length, minSize: MIN_HTML_SIZE },
      'HTML size too small, Playwright needed',
    );
    return true;
  }

  // Check for JavaScript indicators
  const htmlLower = fetchResult.html.toLowerCase();
  const hasJsIndicator = JS_INDICATORS.some((indicator) =>
    htmlLower.includes(indicator.toLowerCase()),
  );

  if (hasJsIndicator) {
    logger.debug('JavaScript indicators found, Playwright needed');
    return true;
  }

  // Check if parsing yielded minimal data
  if (!parsedProfile) {
    return true;
  }

  const hasMinimalData =
    !parsedProfile.displayName && !parsedProfile.bio && !parsedProfile.avatarUrl;

  if (hasMinimalData) {
    logger.debug('Minimal data parsed, Playwright needed');
    return true;
  }

  return false;
}
