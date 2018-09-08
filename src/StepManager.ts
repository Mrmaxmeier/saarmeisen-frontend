import { IGameProtocol, IInit, IField, IStanding } from "./protocol";

export interface GameState {
  standings: IStanding[];
  fields: IField[];
  currentStepIndex: number;
  stepCount: number | string;
}

export interface IStepManager {
  init: IInit;
  hasNext: () => boolean;
  hasPrev: () => boolean;
  next: () => GameState;
  prev: () => GameState;
  getState: () => GameState;
}

export function applyFieldChange(orig: IField[], changes: IField[]): IField[] {
  let fields = orig.slice();
  changes.forEach(f => {
    let i = fields.findIndex(o => f.x === o.x && f.y === o.y);
    fields[i] = f;
  });
  return fields;
}

export class StepManager implements IStepManager {
  public init: IInit;

  private game: IGameProtocol;
  private state: GameState;
  private undo: IField[][] = [];

  constructor(game: IGameProtocol) {
    this.init = game.init;
    this.game = game;
    this.state = {
      standings: game.steps.length ? game.steps[0].standings : [],
      fields: game.init.fields,
      currentStepIndex: 0,
      stepCount: game.steps.length
    };
  }

  hasNext(): boolean {
    return this.state.currentStepIndex < this.game.steps.length;
  }
  hasPrev(): boolean {
    return (
      this.state.currentStepIndex > 0 &&
      this.state.currentStepIndex <= this.undo.length
    );
  }

  next(): GameState {
    if (!this.hasNext()) {
      return this.state;
    }
    let step = this.game.steps[this.state.currentStepIndex];

    if (this.state.currentStepIndex >= this.undo.length) {
      // build undo buffer
      let undo = step.fields.map(
        ({ x, y }) =>
          this.state.fields.find(other => other.x === x && other.y === y)!
      );
      this.undo.push(undo);
    }

    let fields = applyFieldChange(this.state.fields, step.fields);
    let standings = step.standings;

    this.state = {
      fields,
      standings,
      currentStepIndex: this.state.currentStepIndex + 1,
      stepCount: this.game.steps.length
    };
    return this.state;
  }

  prev(): GameState {
    let currentStepIndex = this.state.currentStepIndex - 1;
    let { standings } = this.game.steps[currentStepIndex];
    let fields = applyFieldChange(
      this.state.fields,
      this.undo[currentStepIndex]
    );

    this.state = {
      fields,
      standings,
      currentStepIndex,
      stepCount: this.game.steps.length
    };
    return this.state;
  }

  getState() {
    return this.state;
  }
}
