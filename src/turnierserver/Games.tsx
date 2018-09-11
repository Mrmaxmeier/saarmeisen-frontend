import * as React from "react";
import { Table, Message } from "semantic-ui-react";

export interface GameListEntry {
  key: string;
  map: string;
  time: number;
  ttl: number;
  rounds: number;
  pointsA: number;
  pointsB: number;
  brains: string[];
}

interface Props {
  gameList?: GameListEntry[];
  loadVis: (key: string) => void;
}

export class Games extends React.Component<Props, {}> {
  constructor(props: Props) {
    super(props);
  }
  render() {
    let gameList = this.props.gameList;
    return (
      <>
        <Table celled fixed>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Key</Table.HeaderCell>
              <Table.HeaderCell>Map</Table.HeaderCell>
              <Table.HeaderCell>Expires in</Table.HeaderCell>
              <Table.HeaderCell>Sim Length</Table.HeaderCell>
              <Table.HeaderCell>Rounds</Table.HeaderCell>
              <Table.HeaderCell>Brain A</Table.HeaderCell>
              <Table.HeaderCell>Brain B</Table.HeaderCell>
              <Table.HeaderCell>Score A</Table.HeaderCell>
              <Table.HeaderCell>Score B</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {gameList !== undefined
              ? gameList.map(
                  ({
                    key,
                    map,
                    ttl,
                    time,
                    rounds,
                    brains,
                    pointsA,
                    pointsB
                  }) => (
                    <Table.Row key={key}>
                      <Table.Cell>
                        <a href="#" onClick={() => this.props.loadVis(key)}>
                          {key}
                        </a>
                      </Table.Cell>
                      <Table.Cell>{map}</Table.Cell>
                      <Table.Cell>{ttl} s</Table.Cell>
                      <Table.Cell>{time} ms</Table.Cell>
                      <Table.Cell>{rounds}</Table.Cell>
                      <Table.Cell>{brains[0]}</Table.Cell>
                      <Table.Cell>{brains[1]}</Table.Cell>
                      <Table.Cell>{pointsA}</Table.Cell>
                      <Table.Cell>{pointsB}</Table.Cell>
                    </Table.Row>
                  )
                )
              : null}
          </Table.Body>
        </Table>
        {this.props.gameList && this.props.gameList.length === 0 ? (
          <Message
            attached="bottom"
            header="No logged games available"
            content="Qualify your AI or start a game using the 'Trigger Game'-Tab"
          />
        ) : null}
      </>
    );
  }
}
