import * as React from "react";
import { AntVis } from "./AntVis";
import { IField } from "./protocol";
import { DebuggingSelector } from "./GameVis";

export const FieldColors = {
  ".": "lightgrey",
  "#": "grey",
  A: "red",
  B: "blue",
  C: "green"
};

function hexSVGString(size: number) {
  const points = [
    [-1 / 2, -1 / 4],
    [0, -1 / 2],
    [1 / 2, -1 / 4],
    [1 / 2, 1 / 4],
    [0, 1 / 2],
    [-1 / 2, 1 / 4]
  ];
  return points
    .map(coords => {
      const x = coords[0] * Math.sqrt(3) * size * 0.98;
      const y = coords[1] * 2 * size * 0.98;
      return `${x},${y}`;
    })
    .join(" ");
}

interface Props {
  field: IField;
  size: number;
  debuggingSelector?: (sel: DebuggingSelector) => void;
}

export class FieldVis extends React.PureComponent<Props> {
  render() {
    const { x, y, type, ant, food, markers } = this.props.field;

    let hasMarkers = markers.length !== 0;
    if (hasMarkers) {
      hasMarkers = !!markers.find((a) => a.values.indexOf(true) !== -1)
    }

    return (
      <g>
        <polygon
          onClick={() => this.props.debuggingSelector && this.props.debuggingSelector({ field: { x, y} })}
          // style={{ fill: `rgb(${x * 50}, ${y * 50}, 128)` }}
          style={{
            fill:
              type === "="
                ? "url(#dangerZone)"
                : type === "#"
                  ? "url(#diagonalHatch)"
                  : FieldColors[type]
          }}
          className="hexagon"
          points={hexSVGString(this.props.size)}
        />
        {food ? (
          <text
            textAnchor="middle"
            alignmentBaseline="central"
            transform={`translate(0, ${-this.props.size * 0.7})`}
          >
            🍔{food}
          </text>
        ) : null}

        {hasMarkers ? (
          <text textAnchor="middle" alignmentBaseline="central">
            MARKERS
          </text>
        ) : null}

        <text
          textAnchor="middle"
          alignmentBaseline="central"
          transform={`translate(0, ${this.props.size * 0.7})`}
        >
          {x + ", " + y}
        </text>
        {ant ? <AntVis size={this.props.size} ant={ant} debuggingSelector={this.props.debuggingSelector} /> : null}
      </g>
    );
  }
}
