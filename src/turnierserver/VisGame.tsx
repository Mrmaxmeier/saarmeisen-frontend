import * as React from "react";
import { Form, Button, Input, Segment } from "semantic-ui-react";
import { MapPoolEntry } from "./Maps";
import { RankingEntry } from "./Ranking";
import { GzipGameStream } from "../GzipGameStream";
import { GameVis } from "../GameVis";

interface Props {
  ws: any;
  maps?: MapPoolEntry[];
  ranking?: RankingEntry[];
  visGame?: GzipGameStream;
}

interface State {
  visID: string;
}

export class VisGame extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      visID: ""
    };
  }
  render() {
    return (
      <>
        <Segment>
          <Form>
            <Form.Field>
              <label>Game ID</label>
              <Input
                value={this.state.visID}
                onChange={(_, { value }) => this.setState({ visID: value })}
              />
            </Form.Field>
            <Button.Group fluid>
              <Button
                type="submit"
                basic
                color="green"
                onClick={() => {
                  this.props.ws.emit("loadGame", this.state.visID);
                }}
              >
                Query Database
              </Button>
            </Button.Group>
          </Form>
        </Segment>
        {this.props.visGame ? <GameVis game={this.props.visGame} /> : null}
      </>
    );
  }
}
