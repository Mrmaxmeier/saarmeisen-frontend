import * as React from "react";

export class HexGrid extends React.Component<{ size: number }> {
  public hexSVGString() {
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
        const size = this.props.size * 0.98;
        const x = coords[0] * Math.sqrt(3) * size;
        const y = coords[1] * 2 * size;
        return `${x},${y}`;
      })
      .join(" ");
  }
  public tiles() {
    const t = [];
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 6; x++) {
        t.push({ x, y });
      }
    }
    return t;
  }
  public translateHexagon(x: number, y: number) {
    return `translate(${(x + (y % 2) / 2) *
      this.props.size *
      Math.sqrt(3)}, ${(y * this.props.size * 3) / 2})`;
  }
  public render() {
    return (
      <svg style={{ height: "100%", width: "100%" }}>
        <g transform="translate(100, 100)">
          {this.tiles().map(({ x, y }) => (
            <g key={`${x},${y}`} transform={this.translateHexagon(x, y)}>
              <g>
                <polygon
                  style={{ fill: `rgb(${x * 50}, ${y * 50}, 128)` }}
                  className="hexagon"
                  points={this.hexSVGString()}
                />
                <text dy="0.4em" dx="-1em">
                  {x + ", " + y}
                </text>
              </g>
            </g>
          ))}
        </g>
      </svg>
    );
  }
}
