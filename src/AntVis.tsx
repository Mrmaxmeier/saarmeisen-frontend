import * as React from "react";
import { FieldColors } from "./FieldVis";
import { Direction, IAnt } from "./protocol";
import { DebuggingSelector } from "./GameVis";

function directionToDeg(dir: Direction): number {
  switch (dir) {
    case "northwest":
      return -30;
    case "west":
      return -90;
    case "southwest":
      return -150;
    case "southeast":
      return 150;
    case "east":
      return 90;
    case "northeast":
      return 30;
  }
  throw Error("unknown direction " + dir);
}

interface Props {
  ant: IAnt;
  size: number;
  debuggingSelector?: (sel: DebuggingSelector) => void;
}

export class AntVis extends React.Component<Props> {
  render() {
    const { direction, swarm_id, id } = this.props.ant;

    const arrowHead = [[0, -0.6], [-0.2, -0.3], [0.2, -0.3]]
      .map(coords => {
        const x = coords[0] * this.props.size;
        const y = coords[1] * this.props.size;
        return `${x},${y}`;
      })
      .join(" ");

    const arrow = [[0.05, 0.2], [0.05, -0.3], [-0.05, -0.3], [-0.05, 0.2]]
      .map(coords => {
        const x = coords[0] * this.props.size;
        const y = coords[1] * this.props.size;
        return `${x},${y}`;
      })
      .join(" ");

    return (
      <g>
        <g transform={`rotate(${directionToDeg(direction)})`}>
          <polygon
            onClick={() =>
              this.props.debuggingSelector &&
              this.props.debuggingSelector({ ant: id })
            }
            style={{
              fill: FieldColors[swarm_id],
              stroke: "black",
              strokeWidth: "2px"
            }}
            points={arrowHead}
          />
          <polygon style={{ fill: "black" }} points={arrow} />
        </g>
      </g>
    );
  }
}
