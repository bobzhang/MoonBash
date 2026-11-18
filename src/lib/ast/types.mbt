// moon_bash AST Type Definitions
// All types needed for lexing, parsing, and interpreting bash scripts.

// ============================================================================
// Token Types (Lexer output)
// ============================================================================

///|
#derive(Debug, Eq)
pub(all) enum Token {
  // Literals
  Word(String)
  Number(Int64)
  AssignmentWord(String, String, Bool) // name, value, append

  // Operators
  Pipe // |
  PipeAnd // |&
  And // &&
  Or // ||
  Semi // ;
  Ampersand // &
  Newline

  // Redirections
  RedirectIn // <
  RedirectOut // >
  RedirectAppend // >>
  RedirectClobber // >|
  HereDoc // <<
  HereDocStrip // <<-
  HereString // <<<
  DupIn // <&
  DupOut // >&
  RedirectInOut // <>
  RedirectAndOut // &>
  RedirectAndAppend // &>>

  // Grouping
  LeftParen // (
  RightParen // )
  LeftBrace // {
  RightBrace // }
  DoubleBracketOpen // [[
  DoubleBracketClose // ]]

  // Reserved words
  If
  Then
  Elif
  Else
  Fi
  For
  While
  Until
  Do
  Done
  Case
  Esac
  In
  Function
  Select
  Bang // !
  Time

  // Special
  EOF
  FdNumber(Int32) // File descriptor number before redirect
}

///|
pub impl Show for Token with fn output(self, logger) {
  logger.write_string(@debug.to_string(self))
}

// ============================================================================
// AST Nodes
// ============================================================================

///|
/// Top-level script: a sequence of statements.
#derive(Debug)
pub(all) struct Script {
  statements : Array[Statement]
}

///|
/// A statement is a pipeline combined with list operators.
#derive(Debug)
pub(all) enum Statement {
  Pipeline(Pipeline)
  AndList(Pipeline, Statement) // cmd1 && cmd2
  OrList(Pipeline, Statement) // cmd1 || cmd2
  Background(Pipeline) // cmd &
  Sequence(Pipeline, Statement) // cmd1 ; cmd2
}

///|
/// A pipeline connects commands via pipes.
#derive(Debug)
pub(all) struct Pipeline {
  negated : Bool // ! prefix
  commands : Array[Command]
  pipe_stderr : Bool // |& instead of |
}

///|
/// Command variants.
#derive(Debug)
pub(all) enum Command {
  Simple(SimpleCommand)
  Compound(CompoundCommand, Array[Redirection])
  FunctionDef(FunctionDef)
}

///|
/// A simple command with optional assignments, words, and redirections.
#derive(Debug)
pub(all) struct SimpleCommand {
  assignments : Array[Assignment]
  words : Array[Word]
  redirections : Array[Redirection]
}

///|
/// Compound command variants.
#derive(Debug)
pub(all) enum CompoundCommand {
  If(IfClause)
  For(ForClause)
  CStyleFor(CStyleForClause)
  While(WhileClause)
  Until(UntilClause)
  Case(CaseClause)
  Subshell(Script)
  Group(Script)
  ArithmeticCommand(ArithExpr)
  ConditionalCommand(CondExpr)
}

///|
/// if/elif/else/fi clause.
#derive(Debug)
pub(all) struct IfClause {
  condition : Script
  then_branch : Script
  elif_branches : Array[(Script, Script)]
  else_branch : Script?
}

///|
/// for var in words; do body; done
#derive(Debug)
pub(all) struct ForClause {
  var_name : String
  words : Array[Word]? // None = "$@"
  body : Script
}

///|
/// C-style for: for (( init; cond; update )); do body; done
#derive(Debug)
pub(all) struct CStyleForClause {
  init : ArithExpr
  condition : ArithExpr
  update : ArithExpr
  body : Script
}

///|
/// while condition; do body; done
#derive(Debug)
pub(all) struct WhileClause {
  condition : Script
  body : Script
}

///|
/// until condition; do body; done
#derive(Debug)
pub(all) struct UntilClause {
  condition : Script
  body : Script
}

///|
/// case word in pattern) body ;; esac
#derive(Debug)
pub(all) struct CaseClause {
  word : Word
  items : Array[CaseItem]
}

///|
/// A single case item: pattern) body terminator
#derive(Debug)
pub(all) struct CaseItem {
  patterns : Array[Word]
  body : Script
  terminator : CaseTerminator
}

///|
/// Case item terminators.
#derive(Debug, Eq)
pub(all) enum CaseTerminator {
  Break // ;;
  Fallthrough // ;&
  Continue // ;;&
}

///|
/// Function definition.
#derive(Debug)
pub(all) struct FunctionDef {
  name : String
  body : CompoundCommand
  redirections : Array[Redirection]
}

// ============================================================================
// Word and Expansion Types
// ============================================================================

///|
/// A word is composed of parts that may need expansion.
#derive(Debug)
pub(all) struct Word {
  parts : Array[WordPart]
}

///|
/// Individual parts of a word.
#derive(Debug)
pub(all) enum WordPart {
  Literal(String)
  SingleQuoted(String)
  DoubleQuoted(Array[WordPart])
  Variable(String)
  ParameterExpansion(ParamExpansion)
  CommandSubstitution(String)
  ArithmeticExpansion(ArithExpr)
  BraceExpansion(Array[Array[WordPart]])
  TildePrefix(String)
  Glob(GlobPattern)
}

///|
/// Parameter expansion variants.
#derive(Debug)
pub(all) enum ParamExpansion {
  Simple(String) // $VAR
  Default(String, Word, Bool) // ${VAR:-word} / ${VAR-word}
  Assign(String, Word, Bool) // ${VAR:=word} / ${VAR=word}
  Error(String, Word?, Bool) // ${VAR:?word} / ${VAR?word}
  Alternative(String, Word, Bool) // ${VAR:+word} / ${VAR+word}
  Length(String) // ${#VAR}
  Substring(String, ArithExpr, ArithExpr?) // ${VAR:offset:length}
  PrefixRemove(String, Word, Bool) // ${VAR#pat} / ${VAR##pat}
  SuffixRemove(String, Word, Bool) // ${VAR%pat} / ${VAR%%pat}
  Replace(String, Word, Word?, ReplaceMode) // ${VAR/pat/str}
  Uppercase(String, Word?, Bool) // ${VAR^pat} / ${VAR^^pat}
  Lowercase(String, Word?, Bool) // ${VAR,pat} / ${VAR,,pat}
  Indirection(String) // ${!VAR}
}

///|
/// Replace mode for ${VAR/pat/str} variants.
#derive(Debug, Eq)
pub(all) enum ReplaceMode {
  First // ${VAR/pat/str}
  All // ${VAR//pat/str}
  Prefix // ${VAR/#pat/str}
  Suffix // ${VAR/%pat/str}
}

// ============================================================================
// Redirection Types
// ============================================================================

///|
/// A redirection specification.
#derive(Debug)
pub(all) struct Redirection {
  fd : Int32? // File descriptor (None = default)
  fd_var : String? // {varname} for fd variable
  op : RedirectOp
  target : Word
}

///|
/// Redirection operator variants.
#derive(Debug, Eq)
pub(all) enum RedirectOp {
  Input // <
  Output // >
  Append // >>
  Clobber // >|
  InputOutput // <>
  HereDoc(Bool) // << (strip_tabs: Bool)
  HereString // <<<
  DupInput // <&
  DupOutput // >&
  AndOutput // &>
  AndAppend // &>>
}

///|
pub impl Show for RedirectOp with fn output(self, logger) {
  logger.write_string(@debug.to_string(self))
}

// ============================================================================
// Assignment
// ============================================================================

///|
/// A variable assignment: name=value or name+=value
#derive(Debug)
pub(all) struct Assignment {
  name : String
  value : Word?
  append : Bool // += vs =
}

// ============================================================================
// Arithmetic Expressions (placeholder, expanded later)
// ============================================================================

///|
#derive(Debug)
pub(all) enum ArithExpr {
  Num(Int64)
  Var(String)
  BinOp(ArithBinOp, ArithExpr, ArithExpr)
  UnaryOp(ArithUnaryOp, ArithExpr)
  Assign(String, ArithExpr)
  Ternary(ArithExpr, ArithExpr, ArithExpr)
  Raw(String)
}

///|
#derive(Debug, Eq)
pub(all) enum ArithBinOp {
  Add
  Sub
  Mul
  Div
  Mod
  Pow
  Eq
  Ne
  Lt
  Le
  Gt
  Ge
  BitwiseAnd
  BitwiseOr
  BitwiseXor
  ShiftLeft
  ShiftRight
  LogicalAnd
  LogicalOr
}

///|
#derive(Debug, Eq)
pub(all) enum ArithUnaryOp {
  Negate
  BitwiseNot
  LogicalNot
  PreIncr
  PreDecr
  PostIncr
  PostDecr
}

// ============================================================================
// Conditional Expressions (placeholder, expanded later)
// ============================================================================

///|
#derive(Debug)
pub(all) enum CondExpr {
  UnaryTest(String, Word) // -f, -d, -e, -z, -n, etc.
  BinaryTest(Word, String, Word) // =, !=, -eq, -gt, etc.
  And(CondExpr, CondExpr) // &&
  Or(CondExpr, CondExpr) // ||
  Not(CondExpr) // !
  Regex(Word, Word) // =~
}

// ============================================================================
// Glob Pattern (placeholder)
// ============================================================================

///|
#derive(Debug)
pub(all) struct GlobPattern {
  pattern : String
}

// ============================================================================
// Execution Result
// ============================================================================

///|
#derive(Debug)
pub(all) struct ExecResult {
  stdout : String
  stderr : String
  exit_code : Int32
}

///|
/// Create a successful result with stdout output.
pub fn ExecResult::ok(stdout : String) -> ExecResult {
  { stdout, stderr: "", exit_code: 0, }
}

///|
/// Create an error result with stderr output.
pub fn ExecResult::err(stderr : String) -> ExecResult {
  { stdout: "", stderr, exit_code: 1, }
}

///|
/// Create a result with named parameters.
pub fn ExecResult::new(
  stdout~ : String = "",
  stderr~ : String = "",
  exit_code~ : Int32 = 0,
) -> ExecResult {
  { stdout, stderr, exit_code, }
}

// ============================================================================
// Error Type
// ============================================================================

///|
pub(all) suberror BashError {
  BashError(String)
}

// ============================================================================
// Execution Limits
// ============================================================================

///|
#derive(Debug)
pub(all) struct ExecutionLimits {
  max_call_depth : Int32
  max_command_count : Int32
  max_loop_iterations : Int32
  max_string_length : Int32
  max_array_elements : Int32
  max_heredoc_size : Int32
  max_substitution_depth : Int32
  max_glob_operations : Int32
  max_awk_iterations : Int32
  max_sed_iterations : Int32
  max_jq_iterations : Int32
}

///|
pub fn ExecutionLimits::default() -> ExecutionLimits {
  {
    max_call_depth: 100,
    max_command_count: 10000,
    max_loop_iterations: 10000,
    max_string_length: 10 * 1024 * 1024, // 10 MB
    max_array_elements: 100000,
    max_heredoc_size: 10 * 1024 * 1024, // 10 MB
    max_substitution_depth: 50,
    max_glob_operations: 100000,
    max_awk_iterations: 10000,
    max_sed_iterations: 10000,
    max_jq_iterations: 10000,
  }
}

// ============================================================================
// Shell Options
// ============================================================================

///|
#derive(Debug)
pub(all) struct ShellOptions {
  mut errexit : Bool // set -e
  mut nounset : Bool // set -u
  mut pipefail : Bool // set -o pipefail
  mut noclobber : Bool // set -C
  mut xtrace : Bool // set -x
  mut noglob : Bool // set -f
  mut allexport : Bool // set -a
}

///|
pub fn ShellOptions::default() -> ShellOptions {
  {
    errexit: false,
    nounset: false,
    pipefail: false,
    noclobber: false,
    xtrace: false,
    noglob: false,
    allexport: false,
  }
}
