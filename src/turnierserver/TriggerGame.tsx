import * as React from "react";
import { Form, Button, Dropdown } from "semantic-ui-react";
import { MapPoolEntry } from "./Maps";
import { RankingEntry } from "./Ranking";

interface Props {
  ws: any;
  maps?: MapPoolEntry[];
  ranking?: RankingEntry[];
}

interface State {
  brainA: string;
  brainB: string;
  map: string;
}

export class TriggerGame extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      brainA: "",
      brainB: "",
      map: ""
    };
  }
  render() {
    let mapChoices = (this.props.maps || []).map(({ key, name }) => ({
      key,
      value: key,
      text: key + ":" + name
    }));
    let brainChoices = (this.props.ranking || []).map(({ key, name }) => ({
      key,
      value: key,
      text: key + ":" + name
    }));
    return (
      <Form>
        <label>Map</label>
        <Dropdown
          placeholder="select map"
          fluid
          search
          selection
          options={mapChoices}
          onChange={(_, { value }) => this.setState({ map: value as string })}
        />
        <label>Brains</label>
        <Form.Group widths="equal">
          <Dropdown
            placeholder="Select Brain A"
            fluid
            search
            selection
            options={brainChoices}
            onChange={(_, { value }) =>
              this.setState({ brainA: value as string })
            }
          />
          <Dropdown
            placeholder="Select Brain B"
            fluid
            search
            selection
            options={brainChoices}
            onChange={(_, { value }) =>
              this.setState({ brainB: value as string })
            }
          />
        </Form.Group>
        <Button.Group fluid>
          <Button
            type="submit"
            basic
            color="yellow"
            onClick={() => {
              this.props.ws.emit(
                "triggerGame",
                JSON.stringify({
                  lpush: true,
                  brainA: this.state.brainA,
                  brainB: this.state.brainB,
                  map: this.state.map
                })
              );
            }}
          >
            LPUSH game
          </Button>
          <Button
            type="submit"
            basic
            color="green"
            onClick={() => {
              this.props.ws.emit(
                "triggerGame",
                JSON.stringify({
                  lpush: false,
                  brainA: this.state.brainA,
                  brainB: this.state.brainB,
                  map: this.state.map
                })
              );
            }}
          >
            RPUSH game
          </Button>
        </Button.Group>
      </Form>
    );
  }
}
