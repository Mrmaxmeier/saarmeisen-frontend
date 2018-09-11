import * as React from "react";
import { Table } from "semantic-ui-react";

export interface MapPoolEntry {
  key: string;
  weight: number;
  rounds: number;
  games: number;
  name: string;
  time: number;
}

interface Props {
  maps?: MapPoolEntry[];
  loadVis: (key: string) => void;
}

export class Maps extends React.Component<Props, {}> {
  constructor(props: Props) {
    super(props);
  }
  render() {
    let maps = this.props.maps;
    return (
      <>
        <Table celled fixed>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Key</Table.HeaderCell>
              <Table.HeaderCell>Name</Table.HeaderCell>
              <Table.HeaderCell>Weight</Table.HeaderCell>
              <Table.HeaderCell>Rounds</Table.HeaderCell>
              <Table.HeaderCell>Rated Games</Table.HeaderCell>
              <Table.HeaderCell>Avg Simulation Time</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {maps !== undefined
              ? maps.map(({ key, weight, rounds, games, name, time }) => (
                  <Table.Row key={key}>
                    <Table.Cell>
                      <a href="#" onClick={() => this.props.loadVis(key)}>
                        {key}
                      </a>
                    </Table.Cell>
                    <Table.Cell>{name}</Table.Cell>
                    <Table.Cell>{weight}</Table.Cell>
                    <Table.Cell>{rounds}</Table.Cell>
                    <Table.Cell>{games}</Table.Cell>
                    <Table.Cell>{time} ms</Table.Cell>
                  </Table.Row>
                ))
              : null}
          </Table.Body>
        </Table>
      </>
    );
  }
}
