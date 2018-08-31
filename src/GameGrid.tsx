import * as React from "react";
import { FieldVis } from "./FieldVis";
import { game, IField } from "./protocol";
import { DebuggingSelector } from './GameVis'

interface IProps {
  size: number;
  fields: IField[];
  width: number;
  height: number;
  debuggingSelector?: (sel: DebuggingSelector) => void;
}

export class GameGrid extends React.Component<IProps> {
  public tiles(): IField[] {
    return [
      ...game.init.fields,
      {
        x: 1,
        y: 2,
        type: "#",
        markers: []
      },
      {
        x: 1,
        y: 1,
        type: "B",
        markers: [],
        ant: {
          id: 2,
          direction: "southeast",
          carries_food: false,
          program_counter: 0,
          register: [false, false, false, false, false, false],
          rest_time: 0,
          swarm_id: "C"
        }
      },
      {
        x: 1,
        y: 0,
        type: ".",
        markers: [],
        ant: {
          id: 3,
          direction: "southwest",
          carries_food: false,
          program_counter: 0,
          register: [false, false, false, false, false, false],
          rest_time: 0,
          swarm_id: "A"
        }
      }
    ];
  }
  public translateHexagon(x: number, y: number) {
    let tX = (x + (y % 2) / 2) * this.props.size * Math.sqrt(3);
    let tY = (y * this.props.size * 3) / 2;
    return `translate(${tX}, ${tY})`;
  }
  public render() {
    return (
      <svg
        style={{
          height: (this.props.size * (this.props.height + 1/3) * 3) / 2,
          width: this.props.size * (this.props.width + 0.5) * Math.sqrt(3)
        }}
      >
        <defs>
          <pattern
            id="diagonalHatch"
            width="20"
            height="20"
            patternTransform="rotate(30 0 0)"
            patternUnits="userSpaceOnUse"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="20"
              style={{ stroke: "black", strokeWidth: 2 }}
            />
          </pattern>
          <pattern
            id="dangerZone"
            width="30"
            height="30"
            patternTransform="rotate(-45 0 0)"
            patternUnits="userSpaceOnUse"
          >
            <polygon style={{ fill: "black" }} points="0,0 30,0 30,30 0,30" />
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="30"
              style={{ stroke: "yellow", strokeWidth: 30 }}
            />
          </pattern>
        </defs>
        <g
          transform={`translate(${(this.props.size * Math.sqrt(3)) / 2}, ${
            this.props.size
          })`}
        >
          {this.props.fields.map(field => (
            <g
              key={`${field.x},${field.y}`}
              transform={this.translateHexagon(field.x, field.y)}
            >
              <FieldVis size={this.props.size} field={field} debuggingSelector={this.props.debuggingSelector} />
            </g>
          ))}
        </g>
      </svg>
    );
  }
}
