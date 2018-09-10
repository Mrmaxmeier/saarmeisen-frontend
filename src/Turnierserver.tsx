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
import { IInit } from "./protocol";

import { GameVis } from "./GameVis";
import { GameGrid } from "./GameGrid";
import { GzipGameStream } from "./GzipGameStream";

interface RankingEntry {
  key: string;
  name: string;
  elo: number;
  games: number;
}

interface MapPoolEntry {
  key: string;
  weight: number;
  rounds: number;
  games: number;
  name: string;
  time: number;
}

interface GameListEntry {
  key: string;
  map: string;
  ttl: number;
  rounds: number;
  brains: string[];
}

interface State {
  page: "ranking" | "games" | "maps" | "submitMap" | "submitBrain" | "visGame";
  status: { message: string; negative?: boolean; title?: string };
  visID?: string;
  visGame?: GzipGameStream;
  ranking?: RankingEntry[];
  gameList?: GameListEntry[];
  maps?: MapPoolEntry[];
  mapPreview?: IInit;
}

export class Turnierserver extends React.Component<{}, State> {
  private ws: any; // TODO: @types/socket.io-client
  private refreshTimer: number;
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
    this.setState({ page: name }, this.refresh.bind(this));
  }

  refresh() {
    switch (this.state.page) {
      case "ranking":
        this.ws.emit("fetchRanking");
        break;
      case "games":
        this.ws.emit("listGames");
        break;
      case "maps":
        this.ws.emit("listMaps");
        break;
      default:
        return;
    }
  }

  componentDidMount() {
    this.refreshTimer = setInterval(this.refresh.bind(this), 5000);
    const host =
      location.hostname === "saarmeisen.ente.ninja"
        ? "saarmeisen.ente.ninja"
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

    this.ws.on("mapResult", (data: ArrayBuffer) => {
      let mapPreview = new GzipGameStream(new Uint8Array(data)).init;
      this.setState({ mapPreview });
    });

    this.ws.on("ranking", (data: any) => {
      this.setState({ ranking: JSON.parse(data) });
    });

    this.ws.on("mapList", (data: any) => {
      this.setState({ maps: JSON.parse(data) });
    });

    this.ws.on("gameList", (data: string) => {
      this.setState({ gameList: JSON.parse(data) });
    });

    this.ws.on("gameData", (data: ArrayBuffer) => {
      this.setState({ visGame: new GzipGameStream(new Uint8Array(data)) });
    });

    this.ws.emit("fetchRanking");
  }

  componentWillUnmount() {
    this.ws.disconnect();
    clearInterval(this.refreshTimer);
  }

  render() {
    const activeItem = this.state.page;
    return (
      <Container style={{ marginTop: "7em" }}>
        <Menu>
          {[
            { id: "ranking", text: "Global Ranking" },
            { id: "maps", text: "Map-Pool" },
            { id: "games", text: "Games" },
            { id: "submitMap", text: "Submit Map" },
            { id: "submitBrain", text: "Submit Brain" },
            { id: "visGame", text: "Visualize Game" }
          ].map(({ id, text }) => (
            <Menu.Item
              key={id}
              active={activeItem === id}
              name={id}
              onClick={this.handleItemClick}
            >
              {text}
            </Menu.Item>
          ))}
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
          {activeItem === "games" ? (
            <>
              <Table celled fixed>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Key</Table.HeaderCell>
                    <Table.HeaderCell>Map</Table.HeaderCell>
                    <Table.HeaderCell>Expires in</Table.HeaderCell>
                    <Table.HeaderCell>Rounds</Table.HeaderCell>
                    <Table.HeaderCell>Brains</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {this.state.gameList !== undefined
                    ? this.state.gameList.map(
                        ({ key, map, ttl, rounds, brains }) => (
                          <Table.Row key={key}>
                            <Table.Cell>
                              <a
                                href="#"
                                onClick={() => {
                                  this.ws.emit("loadGame", key);
                                  this.setState({
                                    visID: key,
                                    page: 'visGame'
                                  });
                                }}
                              >
                                {key}
                              </a>
                            </Table.Cell>
                            <Table.Cell>{map}</Table.Cell>
                            <Table.Cell>{ttl} s</Table.Cell>
                            <Table.Cell>{rounds}</Table.Cell>
                            <Table.Cell>{JSON.stringify(brains)}</Table.Cell>
                          </Table.Row>
                        )
                      )
                    : null}
                </Table.Body>
              </Table>
            </>
          ) : null}

          {activeItem === "maps" ? (
            <>
              <Table celled fixed>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Key</Table.HeaderCell>
                    <Table.HeaderCell>Name</Table.HeaderCell>
                    <Table.HeaderCell>Weight</Table.HeaderCell>
                    <Table.HeaderCell>Rounds</Table.HeaderCell>
                    <Table.HeaderCell>Rated Games</Table.HeaderCell>
                    <Table.HeaderCell>Time</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {this.state.maps !== undefined
                    ? this.state.maps.map(({ key, weight, rounds, games, name, time }) => (
                        <Table.Row key={key}>
                          <Table.Cell>{key}</Table.Cell>
                          <Table.Cell>{name}</Table.Cell>
                          <Table.Cell>{weight}</Table.Cell>
                          <Table.Cell>{rounds}</Table.Cell>
                          <Table.Cell>{games}</Table.Cell>
                          <Table.Cell>{time}</Table.Cell>
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
                <GameGrid size={60} {...this.state.mapPreview} />
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
                      this.ws.emit("loadGame", this.state.visID);
                    }}
                  >
                    Query Database
                  </Button>
                </Button.Group>
              </Form>
              {this.state.visGame ? (
                <GameVis game={this.state.visGame} />
              ) : null}
            </>
          ) : null}
        </Segment>
      </Container>
    );
  }
}
