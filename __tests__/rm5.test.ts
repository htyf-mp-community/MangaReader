import { extractScriptImageUrls } from '../src/plugins/rm5Parser';

describe('RM5 chapter parser', () => {
  it('extracts image URLs from Next.js script data', () => {
    const script = String.raw`{"imageUrl":"https://img.example/1.webp"}{"imageUrl":"https://img.example/2.jpg"}`;
    expect(extractScriptImageUrls(script)).toEqual([
      'https://img.example/1.webp',
      'https://img.example/2.jpg',
    ]);
  });
});
