import * as React from "react";
import { Form, Button, TextArea } from "semantic-ui-react";
import { getInitialSize } from "../StepManager";
import { GameGrid } from "../GameGrid";
import { IInit } from "../protocol";

interface Props {
  ws: any;
  mapPreview?: IInit;
}

interface State {
  mapData: string;
  name: string;
}

export class SubmitMap extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      name: "",
      mapData: ""
    };
  }
  render() {
    return (
      <>
        <Form>
          <Form.Field>
            <Form.Input
              fluid
              label="Nickname"
              placeholder="cool map 20x20"
              value={this.state.name}
              onChange={(_, { value }) => this.setState({ name: value })}
            />
            <label>Map Data</label>
            <TextArea
              style={{ fontFamily: "monospace" }}
              placeholder={"2\n2\nA.\n.B"}
              value={this.state.mapData}
              onChange={(_, { value }) =>
                this.setState({ mapData: value as string })
              }
            />
          </Form.Field>
          <Button.Group fluid>
            <Button
              type="submit"
              basic
              color="green"
              onClick={() => {
                this.props.ws.emit(
                  "mapRequest",
                  JSON.stringify({
                    map: this.state.mapData,
                    name: this.state.name,
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
                this.props.ws.emit(
                  "mapRequest",
                  JSON.stringify({
                    map: this.state.mapData,
                    name: this.state.name,
                    preview: false
                  })
                );
              }}
            >
              Submit to Pool
            </Button>
          </Button.Group>
        </Form>
        {this.props.mapPreview ? (
          <GameGrid
            showMarkers={null}
            size={getInitialSize(this.props.mapPreview)}
            {...this.props.mapPreview}
          />
        ) : null}
      </>
    );
  }
}
