import * as React from "react";

import { Container } from "semantic-ui-react";

import { IGameProtocol, IField, IStanding } from "./protocol";

import { GameGrid } from "./GameGrid";
import { FieldColors } from "./FieldVis";
import { GzipGameStream } from "./GzipGameStream";
import { StepManager, IStepManager } from "./StepManager";

export interface DebuggingSelector {
  ant?: number;
  field?: { x: number; y: number };
}

interface State {
  standings: IStanding[];
  fields: IField[];
  currentStepIndex: number;
  stepCount: number | string;
  stepTimer?: number;
  timerMode?: string;
  debugging?: DebuggingSelector;
}

interface Props {
  size: number;
  game: IGameProtocol | GzipGameStream;
}

export class GameVis extends React.Component<Props, State> {
  private stepManager: IStepManager;

  constructor(props: Props) {
    super(props);
    this.stepManager = this.getStepManager(props.game);
    this.toggleAutoStep = this.toggleAutoStep.bind(this);
    this.state = this.stepManager.getState();
  }

  getStepManager(game: IGameProtocol | GzipGameStream): IStepManager {
    if (game instanceof GzipGameStream) {
      return game;
    } else {
      return new StepManager(game);
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.game !== this.props.game) {
      // TODO: this is bad
      this.setState({ debugging: undefined }, () => {
        if (this.props.game instanceof GzipGameStream) {
          this.stepManager = this.props.game;
        } else {
          this.stepManager = new StepManager(this.props.game);
        }
        this.setState(this.stepManager.getState());
      });
    }
  }

  clearAutoStep() {
    if (this.state.stepTimer) {
      clearInterval(this.state.stepTimer);
      this.setState({ stepTimer: undefined });
    }
  }

  toggleAutoStep() {
    let [modeC, modeT] = (this.state.timerMode || "1,100").split(",");
    let count = parseInt(modeC, 10);
    let interval = parseInt(modeT, 10);
    if (this.state.stepTimer) {
      this.clearAutoStep();
    } else {
      const timer = setInterval(() => {
        if (!this.stepManager.hasNext()) {
          this.toggleAutoStep();
        } else {
          let state = this.state;
          for (let i = 0; i < count; i++) {
            state = this.stepManager.next();
          }
          this.setState(state);
        }
      }, interval);
      this.setState({ stepTimer: (timer as any) as number });
    }
  }

  render() {
    const { width, height } = this.stepManager.init;
    return (
      <div>
        <Container text>
          {this.state.standings.length ? (
            <table style={{ textAlign: "center" }}>
              <tbody>
                <tr>
                  <th>Swarm</th>
                  <th>Color</th>
                  <th>Score</th>
                  <th>Ants</th>
                </tr>
                {this.state.standings.map(({ score, swarm_id, ants }, i) => (
                  <tr key={i}>
                    <td>{swarm_id}</td>
                    <td style={{ backgroundColor: FieldColors[swarm_id] }} />
                    <td>{score}</td>
                    <td>{ants}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          <div>
            Step: {this.state.currentStepIndex} / {this.state.stepCount}
          </div>
          <button
            onClick={() => {
              this.stepManager = this.getStepManager(this.props.game);
              this.stepManager.reset();
              this.setState(this.stepManager.getState());
            }}
          >
            Reset Game
          </button>
          <button
            disabled={!this.stepManager.hasPrev()}
            onClick={() => {
              this.clearAutoStep();
              this.setState(this.stepManager.prev());
            }}
          >
            Prev Step
          </button>
          <button onClick={this.toggleAutoStep}>
            {this.state.stepTimer ? "Stop" : "Play"}
          </button>
          <select
            name="cars"
            onChange={e => {
              this.setState({ timerMode: e.target.value });
            }}
          >
            <option value="1,100">1, 100ms</option>
            <option value="10,100">10, 100ms</option>
            <option value="1000,1000">1k, 1s</option>
            <option value="10000,1000">10k, 1s</option>
            <option value="100000,1000">100k, 1s</option>
          </select>
          <button
            disabled={!this.stepManager.hasNext()}
            onClick={() => {
              this.clearAutoStep();
              this.setState(this.stepManager.next());
            }}
          >
            Next Step
          </button>
        </Container>
        <div style={{ display: "flex", alignItems: 'center', justifyContent: 'center' }}>
          <GameGrid
            size={this.props.size}
            fields={this.state.fields}
            width={width}
            height={height}
            debuggingSelector={debugging => this.setState({ debugging })}
          />
        </div>
        <Container text>
          {this.state.debugging ? (
            <span>
              Showing information for: {JSON.stringify(this.state.debugging)}
              <button onClick={() => this.setState({ debugging: undefined })}>
                Hide
              </button>
              <br />
              <pre>
                {JSON.stringify(this.debugInfo(this.state.debugging), null, 2)}
              </pre>
            </span>
          ) : (
            <span>Click (field|ant) to show debugging info</span>
          )}
        </Container>
      </div>
    );
  }
  debugInfo(debugging: DebuggingSelector): any {
    if (debugging.field !== undefined) {
      const { x, y } = debugging.field;
      return this.state.fields.find(o => o.x === x && o.y === y);
    } else if (debugging.ant !== undefined) {
      let field = this.state.fields.find(
        f => !!f.ant && f.ant.id === debugging.ant
      );
      return field!.ant!;
    }
    return { invalid: true };
  }
}
