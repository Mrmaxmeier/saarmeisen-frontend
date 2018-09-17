import * as React from "react";
import { AntVis } from "./AntVis";
import { IField } from "./protocol";
import { DebuggingSelector } from "./GameVis";
import { _viridis_data } from "./viridis";

export const FieldColors = {
  ".": "lightgrey",
  "#": "grey",
  A: "red",
  B: "blue",
  C: "green",
  D: "purple",
  E: "yellow",
  F: "cyan",
  G: "pink",
  H: "orange"
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
  size: number;
  showMarkers: string | null;

  field: IField;
  debuggingSelector?: (sel: DebuggingSelector) => void;
}

export class FieldVis extends React.PureComponent<Props> {
  render() {
    const { x, y, type, ant, food, markers } = this.props.field;

    let hasMarkers = markers !== undefined && markers.length !== 0;
    if (hasMarkers) {
      hasMarkers = !!markers.find(a => a.values.indexOf(true) !== -1);
    }

    let markerColor = null;
    if (this.props.showMarkers !== null) {
      let data = (markers || []).find(
        marker => marker.swarm_id === this.props.showMarkers
      );
      let c = -1;
      if (data) {
        for (let i = 0; i < 7; i++) {
          if (data.values[i]) {
            c += Math.pow(2, 7 - i);
          }
        }
      }
      if (c !== -1) {
        markerColor = _viridis_data[c];
      }
    }

    return (
      <g>
        <polygon
          onClick={() =>
            this.props.debuggingSelector &&
            this.props.debuggingSelector({ field: { x, y } })
          }
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
        {markerColor !== null ? <polygon style={{fill: '#000'}} points={hexSVGString(this.props.size * 0.375)}/> : null}
        {markerColor !== null ? (
          <polygon
            onClick={() =>
              this.props.debuggingSelector &&
              this.props.debuggingSelector({ field: { x, y } })
            }
            style={{
              fill: `rgb(${markerColor[0] * 256}, ${markerColor[1] *
                256}, ${markerColor[2] * 256})`
            }}
            points={hexSVGString(this.props.size * 0.35)}
          />
        ) : null}
        {food ? (
          <text
            textAnchor="middle"
            alignmentBaseline="central"
            transform={`translate(0, ${-this.props.size * 0.7})`}
          >
            🍔
            {food}
          </text>
        ) : null}

        {hasMarkers && this.props.showMarkers === null ? (
          <text textAnchor="middle" alignmentBaseline="central">
            MARKERS
          </text>
        ) : null}

        {this.props.size > 70 ? (
          <text
            textAnchor="middle"
            alignmentBaseline="central"
            transform={`translate(0, ${this.props.size * 0.7})`}
          >
            {x + ", " + y}
          </text>
        ) : null}
        {ant ? (
          <AntVis
            size={this.props.size}
            ant={ant}
            debuggingSelector={this.props.debuggingSelector}
          />
        ) : null}
      </g>
    );
  }
}
