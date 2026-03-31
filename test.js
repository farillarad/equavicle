// Test KaTeX rendering of the user's equation types
const katex = require('./katex.min.js');

const testEqs = [
  'v_{initial} = 100 \\text{ km/h} \\div 3.6 = 27.778 \\text{ m/s}',
  'a = \\frac{v_{final}^2 - v_{initial}^2}{2d}',
  '\\alpha = \\frac{-1.924}{0.2286} = -8.417 \\text{ rad/s}^2',
  'I_{rubber} = \\frac{1}{2}(29.44)(0.2286^2 + 0.1016^2) = 0.921 \\text{ kg}\\cdot\\text{m}^2',
  'V = \\pi(R_{out}^2 - R_{in}^2)w_{tire}',
];

testEqs.forEach((eq, i) => {
  try {
    const html = katex.renderToString(eq, { throwOnError: true, displayMode: false });
    console.log(`[${i+1}] OK - ${eq.substring(0, 50)}...`);
  } catch (e) {
    console.log(`[${i+1}] FAIL - ${eq.substring(0, 50)}... => ${e.message}`);
  }
});
