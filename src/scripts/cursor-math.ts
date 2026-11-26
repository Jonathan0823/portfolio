// The pure numbers behind the pixel pointer, kept apart from the drawing so they can be tested without a browser.

export const smoothstep = (t: number): number => t * t * (3 - 2 * t);
