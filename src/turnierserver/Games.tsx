import * as React from "react";
import { Table } from "semantic-ui-react";

export interface GameListEntry {
  key: string;
  map: string;
  ttl: number;
  rounds: number;
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
              <Table.HeaderCell>Rounds</Table.HeaderCell>
              <Table.HeaderCell>Brain A</Table.HeaderCell>
              <Table.HeaderCell>Brain B</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {gameList !== undefined
              ? gameList.map(({ key, map, ttl, rounds, brains }) => (
                  <Table.Row key={key}>
                    <Table.Cell>
                      <a href="#" onClick={() => this.props.loadVis(key)}>
                        {key}
                      </a>
                    </Table.Cell>
                    <Table.Cell>{map}</Table.Cell>
                    <Table.Cell>{ttl} s</Table.Cell>
                    <Table.Cell>{rounds}</Table.Cell>
                    <Table.Cell>{brains[0]}</Table.Cell>
                    <Table.Cell>{brains[1]}</Table.Cell>
                  </Table.Row>
                ))
              : null}
          </Table.Body>
        </Table>
      </>
    );
  }
}
