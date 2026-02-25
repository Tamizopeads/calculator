import React, { useEffect, useRef, useState } from "react";

// Helper component for buttons, now with dynamic colors based on theme
const Key = ({ label, onClick, className = "", ariaLabel, title, type = "num", isDarkMode }) => {
  let baseClasses =
    "select-none rounded-md shadow-md h-10 text-lg font-medium transition-all duration-100 active:scale-[0.98] focus:outline-none focus:ring focus:ring-offset-2 focus:ring-gray-300 flex items-center justify-center";
  let colorClasses = "";

  if (isDarkMode) {
    // Dark Mode Colors (CASIO style)
    switch (type) {
      case "op":
        colorClasses = "bg-orange-600 hover:bg-orange-500 text-white";
        break; // Operator color ORANGE
      case "sci":
        colorClasses = "bg-gray-700/80 hover:bg-gray-600 text-white text-sm";
        break;
      case "exp":
        colorClasses = "bg-gray-600/70 hover:bg-gray-500 text-white text-sm";
        break;
      case "action":
        colorClasses = "bg-blue-600 hover:bg-blue-500 text-white";
        break; // DEL (Blue)
      case "ac":
        colorClasses = "bg-red-600 hover:bg-red-500 text-white";
        break; // AC (Red)
      case "eq":
        colorClasses = "bg-orange-600 hover:bg-orange-500 text-white font-bold";
        break; // EQUALS ORANGE
      default:
        colorClasses = "bg-gray-700 hover:bg-gray-600 text-white";
        break;
    }
  } else {
    // Light Mode Colors (Clean aesthetic)
    baseClasses = baseClasses.replace("shadow-md", "shadow-sm");
    switch (type) {
      case "op":
        colorClasses = "bg-orange-400 hover:bg-orange-500 text-white";
        break; // Operator ORANGE
      case "sci":
        colorClasses = "bg-blue-100 hover:bg-blue-200 text-blue-800 text-sm";
        break;
      case "exp":
        colorClasses = "bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm";
        break;
      case "action":
        colorClasses = "bg-blue-400 hover:bg-blue-500 text-white";
        break; // DEL (Blue)
      case "ac":
        colorClasses = "bg-red-500 hover:bg-red-600 text-white";
        break; // AC (Red)
      case "eq":
        colorClasses = "bg-orange-400 hover:bg-orange-500 text-white font-bold";
        break; // EQUALS ORANGE
      default:
        colorClasses = "bg-gray-100 hover:bg-gray-200 text-gray-900";
        break;
    }
  }

  return (
    <button
      title={title || ariaLabel || label}
      aria-label={ariaLabel || label}
      onClick={onClick}
      className={`${baseClasses} ${colorClasses} ${className}`}
    >
      <span className="leading-none">{label}</span>
    </button>
  );
};

export default function CalculatorApp() {
  // Theme State (External) - Default is Dark
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Expression-based State
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState("0");
  const [lastAns, setLastAns] = useState(null); // 'Ans' key

  // Dynamic Theme Class Definitions
  const theme = isDarkMode
    ? {
        shell: "bg-gray-900 text-gray-200",
        panel: "bg-gray-800 text-white p-2 rounded-xl shadow-2xl border-gray-700 border-2",
        screenBg: "bg-gray-900 p-2 rounded-lg border-2 border-gray-700",
        displayTop: "text-green-400",
        displayMain: "text-white",
        creditText: "text-gray-500",
      }
    : {
        shell: "bg-gray-100 text-gray-800",
        panel: "bg-white text-gray-900 p-2 rounded-xl shadow-xl border-gray-200 border",
        screenBg: "bg-gray-200 p-2 rounded-lg border border-gray-300",
        displayTop: "text-green-800",
        displayMain: "text-gray-900",
        creditText: "text-gray-600",
      };

  // --- Core Expression Evaluator ---
  const safeEvaluate = (expr) => {
    if (!expr) return "0";
    let processed = expr;

    // --- IMPLICIT MULTIPLICATION HANDLING ---
    // number before constant (4π -> 4*π), number before '(' , number before function
    processed = processed.replace(/(\d+(?:\.\d+)?)([πe])/g, "$1*$2");
    processed = processed.replace(/(\d+(?:\.\d+)?)(\()/g, "$1*$2");
    processed = processed.replace(/(\d+(?:\.\d+)?)(sin|cos|tan|log|ln|sqrt)/g, "$1*$2");
    // ')' before number/'(' /function
    processed = processed.replace(/(\))(\d)/g, "$1*$2");
    processed = processed.replace(/(\))(\()/g, "$1*$2");
    processed = processed.replace(/(\))(sin|cos|tan|log|ln|sqrt)/g, "$1*$2");
    // constant before '(' / function
    processed = processed.replace(/([πe])(\()/g, "$1*$2");
    processed = processed.replace(/([πe])(sin|cos|tan|log|ln|sqrt)/g, "$1*$2");

    // Ans -> (lastAns) or 0
    processed = processed.replace(/Ans/g, lastAns !== null ? `(${lastAns})` : "0");

    // Display symbols -> JS
    processed = processed
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      .replace(/−/g, "-")
      .replace(/π/g, "Math.PI")
      .replace(/e/g, "Math.E")
      .replace(/\^/g, "**");

    // --- FACTORIAL PROCESSING ---
    // 1. Convert terms wrapped in parentheses followed by ! (e.g., (5+2)! -> fact(5+2))
    processed = processed.replace(/(\([^)]+\))!/g, "fact$1");
    
    // 2. Convert plain numbers followed by ! (e.g., 5! -> fact(5))
    processed = processed.replace(/(\d+)!/g, "fact($1)");
    // --- END FACTORIAL PROCESSING ---

    // Functions -> Math.*
    processed = processed
      .replace(/sin\(/g, "Math.sin(")
      .replace(/cos\(/g, "Math.cos(")
      .replace(/tan\(/g, "Math.tan(")
      .replace(/log\(/g, "Math.log10(") // log base 10
      .replace(/ln\(/g, "Math.log(") // natural log
      .replace(/sqrt\(/g, "Math.sqrt(");

    // Auto-balance parentheses
    const opens = (processed.match(/\(/g) || []).length;
    const closes = (processed.match(/\)/g) || []).length;
    if (opens > closes) processed = processed + ")".repeat(opens - closes);

    // Helpers available to evaluator
    function fact(n) {
      n = Math.floor(Number(n));
      // Guard against non-finite, negative, or excessive values (170! is the limit for JS number)
      if (!isFinite(n) || n < 0 || n > 170) return NaN;
      let r = 1;
      for (let i = 2; i <= n; i++) r *= i;
      return r;
    }

    try {
      // Pass 'fact' helper function to the dynamic evaluator
      const calculatedResult = Function("fact", `return (${processed})`)(fact);
      if (!isFinite(calculatedResult)) return "Error";
      const formatted = calculatedResult.toFixed(12).replace(/\.?0+$/, "");
      return formatted;
    } catch (e) {
      return "Syntax Error";
    }
  };

  // --- Helpers to wrap the *last operand* (number, π, e or (...) ) ---
  const getLastOperandSpan = () => {
    // Identify the last number, constant (π, e), or a complete parenthesized expression
    const m = expression.match(/(\([^()]*\)|π|e|\d+(?:\.\d+)?)$/);
    if (!m) return null;
    return { start: expression.length - m[0].length, text: m[0] };
  };
  
  const wrapTailWith = (before, after) => {
    const span = getLastOperandSpan();
    if (span) {
      setExpression((prev) => prev.slice(0, span.start) + `${before}${span.text}${after}`);
    } else if (lastAns !== null) {
      setExpression(`${before}Ans${after}`);
    } else {
      setExpression(`${before}0${after}`);
    }
    setResult("0");
  };

  // --- Input Handlers (append to expression) ---
  const pushToken = (token) => {
    // prevent double operators (still allow functions like sin()
    if (["+", "-", "*", "/", "^", "×", "÷", "−"].includes(token)) {
      const lastChar = expression.slice(-1);
      if (["+", "-", "*", "/", "×", "÷", "−", "."].includes(lastChar)) {
        setExpression((prev) => prev.slice(0, -1) + token);
        return;
      }
    }
    setExpression((prev) => prev + token);
    setResult("0");
  };
  const pushDigit = (d) => pushToken(d);
  const pushOperator = (op) => pushToken(op);

  const clearAll = () => {
    setExpression("");
    setResult("0");
  };
  const backspace = () => {
    setExpression((prev) => prev.slice(0, -1));
    setResult("0");
  };

  const equals = () => {
    if (expression === "") {
      setResult(String(lastAns ?? "0"));
      return;
    }
    const finalResult = safeEvaluate(expression);
    setResult(finalResult);
    if (finalResult !== "Error" && finalResult !== "Syntax Error") {
      setLastAns(Number(finalResult));
      setExpression(finalResult); // chain calculations
    } else {
      setExpression("");
    }
  };
  
  // --- Dedicated factorial handler ---
  const factorial = () => {
      // Check if the expression is currently empty but there's an Ans value
      if (expression === "" && lastAns !== null) {
          pushToken("Ans!");
          return;
      }
      
      const lastChar = expression.slice(-1);
      // Valid tokens to apply factorial to: ')' (closed expression), number (0-9), 'e', 'π'
      const validEnds = [")", "π", "e", ...Array.from({length: 10}, (_, i) => String(i))];

      if (validEnds.includes(lastChar)) {
          pushToken("!");
      }
      setResult("0");
  };

  // --- Scientific Handlers (token-based) ---
  const sin = () => pushToken("sin(");
  const cos = () => pushToken("cos(");
  const tan = () => pushToken("tan(");
  const log10 = () => pushToken("log(");
  const ln = () => pushToken("ln(");
  const sqrt = () => pushToken("sqrt(");

  // Wrap last operand versions
  const x_squared = () => wrapTailWith("(", ")^2");
  const x_inverse = () => wrapTailWith("(", ")^(-1)");
  const ten_to_x = () => pushToken("10^("); // This function is better as a prefix

  // Constants insertion
  const insertConst = (val) => pushToken(val);

  // Keyboard listener
  useEffect(() => {
    const handleKey = (e) => {
      const { key } = e;
      if (/^[0-9\.+\-*/]$/.test(key)) {
        if (key === ".") return pushToken(".");
        if (key === "+") return pushOperator("+");
        if (key === "-") return pushOperator("−"); // display minus
        if (key === "*") return pushOperator("×");
        if (key === "/") return pushOperator("÷");
        return pushDigit(key);
      }
      if (key === "Enter" || key === "=") return equals();
      if (key === "Backspace") return backspace();
      if (key === "Escape") return clearAll();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [expression, lastAns]);

  const isError = result === "Error" || result === "Syntax Error";

  return (
    <div className={`min-h-screen w-full flex items-center justify-center p-4 ${theme.shell}`}>
      <div className="w-full max-w-sm sm:max-w-md">
        {/* EXTERNAL MODE TOGGLE */}
        <div className="flex justify-end mb-3">
          <button
            onClick={() => setIsDarkMode((prev) => !prev)}
            className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors duration-200 shadow-lg 
                            ${isDarkMode ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-gray-200 text-gray-800 hover:bg-gray-300"}`}
          >
            {isDarkMode ? "🌞 Light Mode" : "🌙 Dark Mode"}
          </button>
        </div>

        <div className={`${theme.panel}`}>
          {/* Display Area */}
          <div className={`${theme.screenBg} mb-4 h-20 sm:h-24 flex flex-col justify-between text-right font-mono`}>
            <div className={`text-[12px] sm:text-sm h-6 overflow-x-auto whitespace-nowrap ${theme.displayTop}`}>
              {expression || "Ready"}
            </div>
            <div className={`text-2xl sm:text-3xl font-semibold overflow-x-auto whitespace-nowrap ${isError ? "text-red-400" : theme.displayMain}`}>
              {result}
            </div>
          </div>

          {/* Developer Credit Line */}
          <div className={`text-center text-[10px] mb-2 font-sans tracking-widest uppercase ${theme.creditText}`}>by Temesgen</div>

          {/* Keypad */}
          <div className="space-y-2">
            {/* Scientific Function Keys */}
            <div className="grid grid-cols-5 gap-2 pt-2 border-t border-gray-700">
              {/* Row 1 */}
              <Key label="x⁻¹" type="sci" onClick={x_inverse} isDarkMode={isDarkMode} />
              <Key label="√" type="sci" onClick={sqrt} isDarkMode={isDarkMode} />
              <Key label="x²" type="sci" onClick={x_squared} isDarkMode={isDarkMode} />
              <Key label="log" type="sci" onClick={log10} isDarkMode={isDarkMode} />
              <Key label="ln" type="sci" onClick={ln} isDarkMode={isDarkMode} />

              {/* Row 2 */}
              <Key label="sin" type="sci" onClick={sin} isDarkMode={isDarkMode} />
              <Key label="cos" type="sci" onClick={cos} isDarkMode={isDarkMode} />
              <Key label="tan" type="sci" onClick={tan} isDarkMode={isDarkMode} />
              <Key label="π" type="sci" onClick={() => insertConst("π")} isDarkMode={isDarkMode} />
              <Key label="e" type="sci" onClick={() => insertConst("e")} isDarkMode={isDarkMode} />
            </div>

            {/* Expression Keys */}
            <div className="grid grid-cols-5 gap-2 pt-1">
              <Key label="(" type="exp" onClick={() => pushToken("(")} isDarkMode={isDarkMode} />
              <Key label=")" type="exp" onClick={() => pushToken(")")} isDarkMode={isDarkMode} />
              <Key label="^" type="exp" onClick={() => pushToken("^")} isDarkMode={isDarkMode} />
              <Key label="%" type="exp" onClick={() => pushToken("*0.01")} isDarkMode={isDarkMode} />
              {/* FIXED: Using dedicated factorial function to prevent double parentheses */}
              <Key label="x!" type="exp" onClick={factorial} isDarkMode={isDarkMode} />
            </div>

            {/* Main Keypad */}
            <div className="grid grid-cols-5 gap-2 pt-2 border-t border-gray-700">
              {/* Row 1 */}
              <Key label="7" type="num" onClick={() => pushDigit("7")} isDarkMode={isDarkMode} />
              <Key label="8" type="num" onClick={() => pushDigit("8")} isDarkMode={isDarkMode} />
              <Key label="9" type="num" onClick={() => pushDigit("9")} isDarkMode={isDarkMode} />
              <Key label="DEL" type="action" onClick={backspace} isDarkMode={isDarkMode} />
              <Key label="AC" type="ac" onClick={clearAll} isDarkMode={isDarkMode} />

              {/* Row 2 */}
              <Key label="4" type="num" onClick={() => pushDigit("4")} isDarkMode={isDarkMode} />
              <Key label="5" type="num" onClick={() => pushDigit("5")} isDarkMode={isDarkMode} />
              <Key label="6" type="num" onClick={() => pushDigit("6")} isDarkMode={isDarkMode} />
              <Key label="×" type="op" onClick={() => pushOperator("×")} isDarkMode={isDarkMode} />
              <Key label="÷" type="op" onClick={() => pushOperator("÷")} isDarkMode={isDarkMode} />

              {/* Row 3 */}
              <Key label="1" type="num" onClick={() => pushDigit("1")} isDarkMode={isDarkMode} />
              <Key label="2" type="num" onClick={() => pushDigit("2")} isDarkMode={isDarkMode} />
              <Key label="3" type="num" onClick={() => pushDigit("3")} isDarkMode={isDarkMode} />
              <Key label="+" type="op" onClick={() => pushOperator("+")} isDarkMode={isDarkMode} />
              <Key label="−" type="op" onClick={() => pushOperator("−")} isDarkMode={isDarkMode} />

              {/* Row 4 */}
              <Key label="0" type="num" onClick={() => pushDigit("0")} isDarkMode={isDarkMode} />
              <Key label="." type="num" onClick={() => pushToken(".")} isDarkMode={isDarkMode} />
              <Key label="x10^x" type="sci" onClick={ten_to_x} isDarkMode={isDarkMode} />
              <Key label="Ans" type="op" onClick={() => pushToken("Ans")} isDarkMode={isDarkMode} />
              <Key label="=" type="eq" onClick={equals} isDarkMode={isDarkMode} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
