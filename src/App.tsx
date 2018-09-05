import * as React from "react";
import { Button, Header, Image, Icon, Modal, Container, Dropdown, Menu } from "semantic-ui-react";
import { connect } from 'socket.io-client'

import "semantic-ui-css/semantic.min.css";
import "./App.css";
import { FileDropZone } from "./FileDropZone";
import { GameVis } from "./GameVis";
import { game as sampleGame, IGameProtocol } from "./protocol";

interface IState {
  size: number;
  game: IGameProtocol;
  page: "vis" | "consent" | "turnierserver";
}

class App extends React.Component<{}, IState> {
  private ws: any // TODO: @types/socket.io-client

  constructor(props: {}) {
    super(props);

    this.state = {
      size: 80,
      game: sampleGame,
      page: "vis"
    };

    this.onGameProtocol = this.onGameProtocol.bind(this);
  }

  componentDidMount() {
    console.log("hi");
    localStorage.getItem("turnierserver_conset");
  }

  onTurnierserver() {
    if (this.ws === undefined) {
      this.ws = connect(location.hostname)
      this.ws.on('test', (data: any) => console.log('ws:', data))
    }
    this.setState({ page: 'consent' })
  }

  onGameProtocol(data: any) {
    console.log("onGameProtocol");
    const game = data as IGameProtocol;
    this.setState({ game });
  }

  public render() {
    if (this.state.page === "consent") {
      return (
        <div>
          <Modal trigger={<Button>Basic Modal</Button>} basic size="small">
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
              </span>
            </Modal.Content>
            <Modal.Actions>
              <Button basic color="red" inverted>
                <Icon name="remove" /> Nein
              </Button>
              <Button color="green" inverted>
                <Icon name="checkmark" /> Doch
              </Button>
              <Button color="green" inverted>
                <Icon name="checkmark" /> Ooh!
              </Button>
            </Modal.Actions>
          </Modal>
        </div>
      );
    }
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
              onClick={() => {
                if (
                  location.hostname !== "localhost" &&
                  localStorage.getItem("consent") === null
                ) {
                  this.setState({ page: "consent" });
                } else {
                  this.setState({ page: "turnierserver" });
                }
              }}
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
                  <th>TODO</th>
                  <td>Turnierserver</td>
                </tr>
                <tr>
                  <th>Protocol</th>
                  <td>
                    <FileDropZone onData={this.onGameProtocol} />
                  </td>
                </tr>
                <tr>
                  <th>HexSize</th>
                  <td>
                    <input
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
            <div>
              <GameVis {...this.state} />
            </div>
          </Container>
        ) : null}
      </div>
    );
  }
}

export default App;
