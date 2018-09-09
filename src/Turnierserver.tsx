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
  Message,
  Table,
  Input
} from "semantic-ui-react";
import { connect } from "socket.io-client";
import { IGameProtocol } from "./protocol";

import { GameVis } from "./GameVis";
import { GameGrid } from "./GameGrid";

interface RankingEntry {
  key: string;
  name: string;
  elo: number;
  games: number;
}

interface State {
  page: "ranking" | "submitMap" | "submitBrain" | "visGame";
  status: { message: string; negative?: boolean; title?: string };
  visID?: string;
  visGame?: IGameProtocol;
  ranking?: RankingEntry[];
  mapPreview?: IGameProtocol;
}

export class Turnierserver extends React.Component<{}, State> {
  private ws: any; // TODO: @types/socket.io-client
  private mapForm: TextArea;
  private brainForm: TextArea;

  constructor(props: {}) {
    super(props);
    this.state = {
      page: "ranking",
      status: { message: "connecting..." }
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
      location.hostname === "ente.ninja"
        ? "ente.ninja"
        : location.hostname + ":3044";
    this.ws = connect(host);
    this.ws.on("connect", () =>
      this.setState({ status: { message: "connection established" } })
    );
    this.ws.on("disconnect", () =>
      this.setState({
        status: {
          negative: true,
          title: "connection lost",
          message: "will reconnect once server is back up"
        }
      })
    );
    this.ws.on("status", (data: string) =>
      this.setState({ status: JSON.parse(data) })
    );
    this.ws.on("mapResult", (data: any) => {
      console.log("mapResult", data);
      const mapPreview = JSON.parse(data);
      this.setState({ mapPreview });
    });
    this.ws.on("ranking", (data: any) => {
      console.log("ranking", data);
      this.setState({ ranking: JSON.parse(data) });
    });

    this.ws.on("gameData", (data: string) => {
      (window as any).gameData = data;
      this.setState({ visGame: JSON.parse(data) });
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
            Global Ranking
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

          <Menu.Item
            name="visGame"
            active={activeItem === "visGame"}
            onClick={this.handleItemClick}
          >
            Visualize Game
          </Menu.Item>
        </Menu>

        <Segment>
          <Message
            info={!this.state.status.negative}
            negative={this.state.status.negative}
          >
            {this.state.status.title ? (
              <Message.Header>{this.state.status.title}</Message.Header>
            ) : null}
            <p>{this.state.status.message}</p>
          </Message>
          {activeItem === "ranking" ? (
            <>
              <Dimmer active={this.state.ranking === undefined}>
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
                  {this.state.ranking !== undefined
                    ? this.state.ranking.map(({ key, name, elo, games }) => (
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
          ) : null}
          {activeItem === "submitMap" ? (
            <>
              <Form>
                <Form.Field>
                  <label>Map Data</label>
                  <TextArea
                    style={{ fontFamily: "monospace" }}
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
                  <GameGrid size={60} {...this.state.mapPreview.init} />
                ) : (
                  "errored while parsing the map"
                )
              ) : null}
            </>
          ) : null}

          {activeItem === "submitBrain" ? (
            <>
              <Form>
                <Form.Field>
                  <label>Brain Data</label>
                  <TextArea
                    style={{ fontFamily: "monospace" }}
                    placeholder={'brain "noop" { jump 0\n}'}
                    ref={e => (this.brainForm = e!)}
                  />
                </Form.Field>
                <Button.Group fluid>
                  <Button
                    type="submit"
                    basic
                    color="yellow"
                    onClick={() => {
                      const brainStr = (this.brainForm as any).ref.value;
                      this.ws.emit("brainRequest", brainStr);
                    }}
                  >
                    Qualify brain
                  </Button>
                </Button.Group>
              </Form>
            </>
          ) : null}

          {activeItem === "visGame" ? (
            <>
              <Form>
                <Form.Field>
                  <label>Game ID</label>
                  <Input
                    value={this.state.visID || ""}
                    onChange={e =>
                      this.setState({ visID: (e.target as any).value })
                    }
                  />
                </Form.Field>
                <Button.Group fluid>
                  <Button
                    type="submit"
                    basic
                    color="green"
                    onClick={() => {
                      this.ws.emit(
                        "loadGame",
                        JSON.stringify({ key: this.state.visID })
                      );
                    }}
                  >
                    Query Database
                  </Button>
                </Button.Group>
              </Form>
              {this.state.visGame ? (
                this.state.visGame.init !== null ? (
                  <GameVis size={60} game={this.state.visGame} />
                ) : (
                  "init empty"
                )
              ) : null}
            </>
          ) : null}
        </Segment>
      </Container>
    );
  }
}
