import { IGameProtocol, IField, IStanding } from "./protocol";

interface GameState {
  standings: IStanding[];
  fields: IField[];
  currentStepIndex: number;
}

export class StepManager {
  private game: IGameProtocol;
  private state: GameState;
  private undo: IField[][] = [];

  constructor(game: IGameProtocol) {
    this.game = game;
    this.state = {
      standings: game.steps.length ? game.steps[0].standings : [],
      fields: game.init.fields,
      currentStepIndex: 0
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

  applyFieldChange(orig: IField[], changes: IField[]): IField[] {
    let fields = orig.slice();
    changes.forEach(f => {
      let i = fields.findIndex(o => f.x === o.x && f.y === o.y);
      fields[i] = f;
    });
    return fields;
  }

  next(): GameState {
    let step = this.game.steps[this.state.currentStepIndex];

    if (this.state.currentStepIndex >= this.undo.length) {
      // build undo buffer
      let undo = step.fields.map(
        ({ x, y }) =>
          this.state.fields.find(other => other.x === x && other.y === y)!
      );
      this.undo.push(undo);
    }

    let fields = this.applyFieldChange(this.state.fields, step.fields);
    let standings = step.standings;

    this.state = {
      fields,
      standings,
      currentStepIndex: this.state.currentStepIndex + 1
    };
    return this.state;
  }

  prev(): GameState {
    let currentStepIndex = this.state.currentStepIndex - 1;
    let { standings } = this.game.steps[currentStepIndex];
    let fields = this.applyFieldChange(
      this.state.fields,
      this.undo[currentStepIndex]
    );

    this.state = { fields, standings, currentStepIndex };
    return this.state;
  }

  getState() {
    return this.state;
  }
}
