import {
  JUST_BASH_3_COMMAND_NAMES,
  JUST_BASH_3_JAVASCRIPT_COMMAND_NAMES,
  JUST_BASH_3_NETWORK_COMMAND_NAMES,
  JUST_BASH_3_PYTHON_COMMAND_NAMES,
} from "../compat/just-bash-3";

export type CommandName = (typeof JUST_BASH_3_COMMAND_NAMES)[number];
export type NetworkCommandName = (typeof JUST_BASH_3_NETWORK_COMMAND_NAMES)[number];
export type PythonCommandName = (typeof JUST_BASH_3_PYTHON_COMMAND_NAMES)[number];
export type JavaScriptCommandName = (typeof JUST_BASH_3_JAVASCRIPT_COMMAND_NAMES)[number];
export type AllCommandName =
  | CommandName
  | NetworkCommandName
  | PythonCommandName
  | JavaScriptCommandName;

export function getCommandNames(): string[] {
  return [...JUST_BASH_3_COMMAND_NAMES];
}

export function getNetworkCommandNames(): string[] {
  return [...JUST_BASH_3_NETWORK_COMMAND_NAMES];
}

export function getPythonCommandNames(): string[] {
  return [...JUST_BASH_3_PYTHON_COMMAND_NAMES];
}

export function getJavaScriptCommandNames(): string[] {
  return [...JUST_BASH_3_JAVASCRIPT_COMMAND_NAMES];
}
