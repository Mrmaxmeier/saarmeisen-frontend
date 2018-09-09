import * as React from "react";
import {
  Button,
  Header,
  Image,
  Icon,
  Modal,
  Container,
  Dropdown,
  Menu
} from "semantic-ui-react";

import "semantic-ui-css/semantic.min.css";
import "./App.css";
import { FileDropZone } from "./FileDropZone";
import { GameVis } from "./GameVis";
import { Turnierserver } from "./Turnierserver";
import { GzipGameStream } from "./GzipGameStream";
import { game as sampleGame, IGameProtocol } from "./protocol";

interface IState {
  size: number;
  game: IGameProtocol | GzipGameStream;
  page: "vis" | "consent" | "turnierserver";
}

class App extends React.Component<{}, IState> {
  constructor(props: {}) {
    super(props);

    this.state = {
      size: 80,
      game: sampleGame,
      page: "vis"
    };

    this.onGameProtocol = this.onGameProtocol.bind(this);
  }

  onTurnierserver() {
    if (
      location.hostname !== "localhost" &&
      localStorage.getItem("consent") === null
    ) {
      this.setState({ page: "consent" });
    } else {
      this.setState({ page: "turnierserver" });
    }
  }

  onGameProtocol(filename: string, logfile: ArrayBuffer) {
    console.log("onGameProtocol", filename);
    if (filename.endsWith(".json")) {
      let text = new TextDecoder("utf-8").decode(logfile);
      const game = JSON.parse(text) as IGameProtocol;
      this.setState({ game });
    } else if (filename.endsWith(".json.gz")) {
      console.log("stream memes", logfile);
      let buf = new Uint8Array(logfile);
      this.setState({ game: new GzipGameStream(buf) });
    } else {
      console.error("can't handle", filename);
    }
  }

  public render() {
    return (
      <div>
        <Menu fixed="top" inverted>
          <Container>
            <Menu.Item as="a" header>
              <Image
                size="mini"
                src={require("./logo.png")}
                style={{ marginRight: "1.5em" }}
              />
              Saarmeisen
            </Menu.Item>
            <Menu.Item
              as="a"
              active={this.state.page === "vis"}
              onClick={() => this.setState({ page: "vis" })}
            >
              Log Visualizer
            </Menu.Item>
            <Menu.Item
              as="a"
              active={this.state.page === "turnierserver"}
              onClick={() => this.onTurnierserver()}
            >
              Turnierserver
            </Menu.Item>

            <Dropdown item simple text="Dropdown">
              <Dropdown.Menu>
                <Dropdown.Item>List Item</Dropdown.Item>
                <Dropdown.Item>List Item</Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Header>Header Item</Dropdown.Header>
                <Dropdown.Item>
                  <i className="dropdown icon" />
                  <span className="text">Submenu</span>
                  <Dropdown.Menu>
                    <Dropdown.Item>List Item</Dropdown.Item>
                    <Dropdown.Item>List Item</Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown.Item>
                <Dropdown.Item>List Item</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </Container>
        </Menu>

        {this.state.page === "vis" ? (
          <>
            <Container text style={{ marginTop: "7em" }}>
              <table>
                <tbody>
                  <tr>
                    <th>Issue Tracker</th>
                    <td>
                      <a href="https://github.com/Mrmaxmeier/saarmeisen-frontend">
                        github.com/Mrmaxmeier/saarmeisen-frontend
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <th>Protocol</th>
                    <td>
                      <FileDropZone onData={this.onGameProtocol}>
                        DragnDrop {"{.json,.json.gz}"} files into the window
                      </FileDropZone>
                    </td>
                  </tr>
                  <tr>
                    <th>Note</th>
                    <td>
                      Only reasonable .json.gz files are supported. <br />
                      They're streamed to combat back-pressure, so you won't be
                      able to undo moves.
                    </td>
                  </tr>
                  <tr>
                    <th>HexSize</th>
                    <td>
                      <input
                      min={25}
                        type="number"
                        value={this.state.size}
                        onChange={e =>
                          this.setState({ size: parseInt(e.target.value, 10) })
                        }
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </Container>
            <GameVis {...this.state} />
          </>
        ) : null}

        {this.state.page === "turnierserver" ? <Turnierserver /> : null}

        {this.state.page === "consent" ? (
          <Modal
            trigger={<Button>Basic Modal</Button>}
            basic
            size="small"
            open
            onClose={() => this.setState({ page: "vis" })}
          >
            <Header icon="warning sign" content="Sie begehn eine Straftat" />
            <Modal.Content image>
              <Image wrapped size="medium" src={require("./stroofdood.png")} />
              <span>
                <p>Disclaimer: Keine echten KIs hochladen und so.</p>
                <p>Die Ameisen-Brains werden:</p>
                <ul>
                  <li>Auf dem Server in einer Datenbank gespeichert</li>
                  <li>In einem Rating für neue Spiele verarbeitet</li>
                  <li>Ihre Strategien in öffentlichen Spielen verraten</li>
                </ul>
                <p>
                  Bist du damit einverstanden, dass die ominöse Ente deine
                  KI-Strategien zur Weltherrschaft ausnutzen wird?
                </p>
                <p>
                  <b>Offizielle Info: </b>
                  Plagiate fuehren zum Ausschluss beider Gruppen.
                </p>
              </span>
            </Modal.Content>
            <Modal.Actions>
              <Button
                basic
                color="red"
                inverted
                onClick={() => this.setState({ page: "vis" })}
              >
                <Icon name="remove" /> Nein
              </Button>
              <Button
                color="green"
                inverted
                onClick={() => this.setState({ page: "turnierserver" })}
              >
                <Icon name="checkmark" /> Doch
              </Button>
              <Button
                color="green"
                inverted
                onClick={() => {
                  localStorage.setItem("consent", "ooh");
                  this.setState({ page: "turnierserver" });
                }}
              >
                <Icon name="checkmark" /> Ooh!
              </Button>
            </Modal.Actions>
          </Modal>
        ) : null}
      </div>
    );
  }
}

export default App;
