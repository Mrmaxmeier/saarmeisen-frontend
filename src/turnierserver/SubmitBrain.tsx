import * as React from "react";
import { Form, Button, TextArea } from "semantic-ui-react";

interface Props {
  ws: any;
}

interface State {
  brainData: string;
}

export class SubmitBrain extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      brainData: ""
    };
  }
  render() {
    return (
      <Form>
        <Form.Field>
          <label>Brain Data</label>
          <TextArea
            style={{ fontFamily: "monospace" }}
            placeholder={'brain "noop" { jump 0\n}'}
            value={this.state.brainData}
            onChange={(_, { value }) =>
              this.setState({ brainData: value as string })
            }
          />
        </Form.Field>
        <Button.Group fluid>
          <Button
            type="submit"
            basic
            color="yellow"
            onClick={() => {
              this.props.ws.emit("brainRequest", this.state.brainData);
            }}
          >
            Qualify brain
          </Button>
        </Button.Group>
      </Form>
    );
  }
}
