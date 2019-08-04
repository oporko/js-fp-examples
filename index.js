const {
  add,
  addIndex,
  always,
  assoc,
  cond,
  complement,
  compose,
  defaultTo,
  equals,
  evolve,
  filter,
  inc,
  join,
  lensIndex,
  lensProp,
  lte,
  map,
  over,
  partialRight,
  pathOr,
  prop,
  reduce,
  reduceRight,
  repeat,
  split,
  T,
  tap,
  tryCatch,
  uncurryN,
  unless,
  view,
  when,
  zipWith
} = require("ramda");
const { inspect } = require("util");
const Result = require("folktale/result");
const { readFileSync } = require("fs");

// TYPES
//
// TestResult :: { student: string, test: string[], score: int[] }
// Exam :: { answers: string[], results: TestResult[], correct: int[] }

const log = tap(console.log.bind(console));

const logObj = tap(
  compose(
    console.log.bind(console),
    partialRight(inspect, [{ showHidden: false, depth: null }])
  )
);

const examArgLens = lensIndex(2);

// process -> string
const getExamFilename = compose(
  defaultTo("exam.txt"),
  view(examArgLens),
  prop("argv")
);

// string -> Result string string
const safeReadFileSync = tryCatch(
  compose(
    Result.Ok,
    partialRight(readFileSync, [{ encoding: "utf8" }])
  ),
  Result.Error
);

// string -> TestResult
const parseTestResult = compose(
  evolve({ test: split("") }),
  ([student, test]) => ({ student, test }),
  split(" ")
);

// string -> Exam
const parseExam = compose(
  evolve({
    answers: split(""),
    results: map(parseTestResult),
    correct: repeat(0)
  }),
  ([answers, ...results]) => ({ answers, results, correct: answers.length })
);

// a -> b -> boolean
const neq = complement(equals);

// string -> Result string Exam
const loadExam = compose(
  map(parseExam),
  map(filter(neq("0"))),
  map(split("\n")),
  safeReadFileSync
);

// string -> string -> int
const getScore = (expected, actual) =>
  cond([
    [equals(expected), always(4)],
    [equals("X"), always(0)],
    [T, always(-1)]
  ])(actual);

const resultsLens = lensProp("results");

// string[] -> TestResult -> TestResult
const calcScore = answers => result =>
  assoc("score", zipWith(getScore, answers, result.test), result);

// Exam -> Exam
const calcScores = exam =>
  over(resultsLens, map(calcScore(exam.answers)), exam);

// int -> boolean
const isCorrect = equals(4);

// int -> int -> int
const incCount = answer => when(_ => isCorrect(answer), inc);

// int[] -> int[] -> int[]
const countCorrect = zipWith(uncurryN(2, incCount));

// Exam -> int[]
const makeEmptyResult = compose(
  repeat(0),
  pathOr(0, ["answers", "length"])
);

// Exam -> int[][]
const getScores = compose(
  map(prop("score")),
  prop("results")
);

// Exam -> Exam
const calcCorrect = exam =>
  assoc(
    "correct",
    reduceRight(countCorrect, makeEmptyResult(exam), getScores(exam)),
    exam
  );

// TestResult -> int
const calcFinalScore = compose(
  unless(lte(0), always(0)),
  reduce(add, 0),
  prop("score")
);

// TestResult -> string
const formatTestResult = result =>
  `${result.student} : ${calcFinalScore(result)}`;

// Exam -> string
const formatTestResults = compose(
  join("\n"),
  map(formatTestResult),
  prop("results")
);

// ((a, int) -> a) -> [a] -> [b]
const mapIndexed = addIndex(map);

// Exam -> string
const formatCorrectAnswers = compose(
  join("\n"),
  mapIndexed((val, idx) => `Q${idx + 1}: ${val}`),
  prop("correct")
);

// Exam -> string
const createReport = exam =>
  `Exam results

${formatTestResults(exam)}

Total number of candidates: ${exam.results.length}

Number of correct answers:
${formatCorrectAnswers(exam)}`;

// process -> Result string string
const program = compose(
  map(createReport),
  map(calcCorrect),
  map(calcScores),
  loadExam,
  getExamFilename
);

log(program(process).value);
