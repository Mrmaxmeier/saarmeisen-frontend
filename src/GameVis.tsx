import * as React from "react";

import { IGameProtocol, IField, IStanding, IStep } from "./protocol";

import { GameGrid } from "./GameGrid";
import { FieldColors } from "./FieldVis";

interface State {
  standings: IStanding[];
  fields: IField[];
  step: number;
  stepTimer?: number;
}

interface Props {
  size: number;
  game: IGameProtocol;
}

export class GameVis extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = this.getInitialState(props.game);
    this.toggleAutoStep = this.toggleAutoStep.bind(this);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.game !== this.props.game) {
      this.setState(this.getInitialState(this.props.game));
    }
  }

  getInitialState(game: IGameProtocol): State {
    return {
      step: 0,
      standings: game.steps.length ? game.steps[0].standings : [],
      fields: game.init.fields
    };
  }

  apply(step: IStep, index: number): void {
    let fields = this.state.fields.slice();
    step.fields.forEach(f => {
      let i = fields.findIndex(o => f.x === o.x && f.y === o.y);
      fields[i] = f;
    });
    this.setState({
      standings: step.standings,
      fields,
      step: index + 1
    });
  }

  toggleAutoStep() {
    if (this.state.stepTimer) {
      clearInterval(this.state.stepTimer);
      this.setState({ stepTimer: undefined });
    } else {
      const timer = setInterval(() => {
        let next = this.state.step;
        if (next >= this.props.game.steps.length) {
          this.toggleAutoStep();
        } else {
          this.apply(this.props.game.steps[next], next);
        }
      }, 100);
      this.setState({ stepTimer: (timer as any) as number });
    }
  }

  render() {
    const { width, height } = this.props.game.init;
    return (
      <div style={{ width: "100%", height: "100%" }}>
        <div>GameVis memes</div>
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
          Step: {this.state.step} / {this.props.game.steps.length}
        </div>
        <button
          onClick={() => {
            this.setState(this.getInitialState(this.props.game));
          }}
        >
          Reset Game
        </button>
        <button disabled={true}>Prev Step</button>
        <button onClick={this.toggleAutoStep}>
          {this.state.stepTimer ? "Stop" : "Play"}
        </button>
        <button
          onClick={() => {
            this.apply(this.props.game.steps[this.state.step], this.state.step);
          }}
          disabled={this.state.step === this.props.game.steps.length}
        >
          Next Step
        </button>
        <GameGrid
          size={this.props.size}
          fields={this.state.fields}
          width={width}
          height={height}
        />
      </div>
    );
  }
}
