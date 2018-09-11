import * as React from "react";
import {
  Dimmer,
  Loader,
  Table,
} from "semantic-ui-react";

export interface RankingEntry {
  key: string;
  name: string;
  elo: number;
  games: number;
}

interface Props {
  ranking?: RankingEntry[]
}

export class Ranking extends React.Component<Props, {}> {
  constructor(props: Props) {
    super(props);
  }
  render() {
    let ranking = this.props.ranking;
    return (
      <>
        <Dimmer active={ranking === undefined}>
          <Loader>Loading</Loader>
        </Dimmer>
        <Table celled fixed>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Key</Table.HeaderCell>
              <Table.HeaderCell>Name</Table.HeaderCell>
              <Table.HeaderCell>Elo</Table.HeaderCell>
              <Table.HeaderCell>Rated Games</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {ranking !== undefined
              ? ranking.map(({ key, name, elo, games }) => (
                  <Table.Row key={key}>
                    <Table.Cell>{key}</Table.Cell>
                    <Table.Cell>{name}</Table.Cell>
                    <Table.Cell>{elo}</Table.Cell>
                    <Table.Cell>{games}</Table.Cell>
                  </Table.Row>
                ))
              : null}
          </Table.Body>
        </Table>
      </>
    );
  }
}
