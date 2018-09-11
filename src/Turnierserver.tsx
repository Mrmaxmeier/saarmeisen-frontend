import * as React from "react";
import { Container, Menu, Segment, Message, Statistic } from "semantic-ui-react";
import { connect } from "socket.io-client";
import { IInit } from "./protocol";

import { GzipGameStream } from "./GzipGameStream";

import { Ranking, RankingEntry } from "./turnierserver/Ranking";
import { Games, GameListEntry } from "./turnierserver/Games";
import { Maps, MapPoolEntry } from "./turnierserver/Maps";
import { SubmitMap } from "./turnierserver/SubmitMap";
import { SubmitBrain } from "./turnierserver/SubmitBrain";
import { TriggerGame } from "./turnierserver/TriggerGame";
import { VisGame } from "./turnierserver/VisGame";

interface State {
  page:
    | "ranking"
    | "games"
    | "maps"
    | "submitMap"
    | "submitBrain"
    | "visGame"
    | "triggerGame"
    | "stats";
  status: { message: string; negative?: boolean; title?: string };
  visID?: string;
  visGame?: GzipGameStream;
  ranking?: RankingEntry[];
  gameList?: GameListEntry[];
  maps?: MapPoolEntry[];
  mapPreview?: IInit;
  stats?: {
    avgRtt: number;
    queued: number;
    connections: number;
  }
}

export class Turnierserver extends React.Component<{}, State> {
  private ws: any; // TODO: @types/socket.io-client
  private refreshTimer: number;

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
      case "triggerGame":
        this.ws.emit("listMaps");
        this.ws.emit("fetchRanking");
        break;
        case "stats":
        this.ws.emit("stats");
        break;
      default:
        return;
    }
  }

  componentDidMount() {
    this.refreshTimer = setInterval(this.refresh.bind(this), 1000);
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

    this.ws.on("stats", (data: string) => {
      this.setState({ stats: JSON.parse(data) });
    })

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
            { id: "visGame", text: "Visualize Game" },
            { id: "triggerGame", text: "Trigger Game" },
            { id: "stats", text: "Stats" }
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
            <Ranking ranking={this.state.ranking} />
          ) : null}
          {activeItem === "games" ? (
            <Games
              gameList={this.state.gameList}
              loadVis={visID => {
                this.ws.emit("loadGame", visID);
                this.setState({ visID, page: "visGame" });
              }}
            />
          ) : null}
          {activeItem === "maps" ? (
            <Maps
              maps={this.state.maps}
              loadVis={visID => {
                this.ws.emit("loadGame", visID);
                this.setState({ visID, page: "visGame" });
              }}
            />
          ) : null}
          {activeItem === "submitMap" ? (
            <SubmitMap ws={this.ws} mapPreview={this.state.mapPreview} />
          ) : null}
          {activeItem === "submitBrain" ? <SubmitBrain ws={this.ws} /> : null}
          {activeItem === "triggerGame" ? (
            <TriggerGame
              ws={this.ws}
              maps={this.state.maps}
              ranking={this.state.ranking}
            />
          ) : null}

          {activeItem === "stats" && this.state.stats !== undefined ? (
            <Statistic.Group>
              <Statistic>
                <Statistic.Value>{this.state.stats.queued}</Statistic.Value>
                <Statistic.Label>In Queue</Statistic.Label>
              </Statistic>
              <Statistic>
                <Statistic.Value>{Math.round(this.state.stats.avgRtt * 100) / 100}</Statistic.Value>
                <Statistic.Label>Average RTT (s)</Statistic.Label>
              </Statistic>
              <Statistic>
                <Statistic.Value>{this.state.stats.connections}</Statistic.Value>
                <Statistic.Label>Active Connections</Statistic.Label>
              </Statistic>
            </Statistic.Group>
          ) : null}
        </Segment>
          {activeItem === "visGame" ? <VisGame ws={this.ws} visGame={this.state.visGame} /> : null}
      </Container>
    );
  }
}
