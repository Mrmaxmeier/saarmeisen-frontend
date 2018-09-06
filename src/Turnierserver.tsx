import * as React from "react";
import {
  Container,
  Menu,
  Dimmer,
  Loader,
  Segment,
  Form,
  TextArea,
  Button,
  Table
} from "semantic-ui-react";
import { connect } from "socket.io-client";
import { IGameProtocol } from "./protocol";

import { GameVis } from "./GameVis";

interface RankingEntry {
  name: string;
  elo: number;
  games: number;
}

interface State {
  page: "ranking" | "submitMap" | "submitBrain";
  ranking?: RankingEntry[];
  mapPreview?: IGameProtocol;
}

export class Turnierserver extends React.Component<{}, State> {
  private ws: any; // TODO: @types/socket.io-client
  private mapForm: TextArea;
  constructor(props: {}) {
    super(props);
    this.state = {
      page: "ranking"
    };
    this.handleItemClick = this.handleItemClick.bind(this);
  }
  handleItemClick(e: any, { name }: any) {
    if (name === "ranking") {
      this.ws.emit("fetchRanking");
    }
    this.setState({ page: name });
  }
  componentDidMount() {
    const host =
      location.hostname === "localhost" ? "localhost:3044" : location.hostname;
    this.ws = connect(host);
    this.ws.on("test", (data: any) => console.log("ws:", data));
    this.ws.on("mapResult", (data: any) => {
      console.log("mapResult", data);
      const mapPreview = JSON.parse(data);
      this.setState({ mapPreview });
    });
    this.ws.on("ranking", (data: any) => {
      console.log("ranking", data);
      this.setState({ ranking: JSON.parse(data) });
    });

    this.ws.emit("fetchRanking");
  }

  componentWillUnmount() {
    this.ws.disconnect();
  }

  render() {
    const activeItem = this.state.page;
    return (
      <Container text style={{ marginTop: "7em" }}>
        <Menu>
          <Menu.Item
            name="ranking"
            active={activeItem === "ranking"}
            onClick={this.handleItemClick}
          >
            Ranking
          </Menu.Item>

          <Menu.Item
            name="submitMap"
            active={activeItem === "submitMap"}
            onClick={this.handleItemClick}
          >
            Submit Map
          </Menu.Item>

          <Menu.Item
            name="submitBrain"
            active={activeItem === "submitBrain"}
            onClick={this.handleItemClick}
          >
            Submit Brain
          </Menu.Item>
        </Menu>

        <Segment>
          {activeItem === "ranking" ? (
            <>
              <Dimmer active={this.state.ranking === undefined}>
                <Loader>Loading</Loader>
              </Dimmer>
              <Table celled fixed>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Name</Table.HeaderCell>
                    <Table.HeaderCell>Elo</Table.HeaderCell>
                    <Table.HeaderCell>Games</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {this.state.ranking !== undefined
                    ? this.state.ranking.map(({ name, elo, games }) => (
                        <Table.Row key={name}>
                          <Table.Cell>{name}</Table.Cell>
                          <Table.Cell>{elo}</Table.Cell>
                          <Table.Cell>{games}</Table.Cell>
                        </Table.Row>
                      ))
                    : null}
                </Table.Body>
              </Table>
            </>
          ) : null}
          {activeItem === "submitMap" ? (
            <>
              <Form>
                <Form.Field>
                  <label>Map Data</label>
                  <TextArea
                    placeholder={"2\n2\nA.\n.B"}
                    ref={e => (this.mapForm = e!)}
                  />
                </Form.Field>
                <Button.Group fluid>
                  <Button
                    type="submit"
                    basic
                    color="green"
                    onClick={() => {
                      const map = (this.mapForm as any).ref.value;
                      this.ws.emit(
                        "mapRequest",
                        JSON.stringify({
                          map,
                          preview: true
                        })
                      );
                    }}
                  >
                    Preview
                  </Button>
                  <Button
                    type="submit"
                    basic
                    color="yellow"
                    onClick={() => {
                      const map = (this.mapForm as any).ref.value;
                      this.ws.emit(
                        "mapRequest",
                        JSON.stringify({
                          map,
                          preview: false
                        })
                      );
                    }}
                  >
                    Submit to Pool
                  </Button>
                </Button.Group>
              </Form>
              {this.state.mapPreview ? (
                this.state.mapPreview.init !== null ? (
                  <GameVis size={60} game={this.state.mapPreview} />
                ) : (
                  "errored while parsing the map"
                )
              ) : null}
            </>
          ) : null}
        </Segment>
      </Container>
    );
  }
}

// placeholder="brain &quot;abc&quot; { jump 0 }"
