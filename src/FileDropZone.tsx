import * as React from "react";

interface IProps {
  onData: (filename: string, result: ArrayBuffer) => void;
}

export class FileDropZone extends React.Component<
  IProps,
  { visible: boolean }
> {
  private dragBox: HTMLDivElement;
  constructor(props: IProps) {
    super(props);
    this.state = {
      visible: false
    };
    this._onDragEnter = this._onDragEnter.bind(this);
    this._onDragLeave = this._onDragLeave.bind(this);
    this._onDragOver = this._onDragOver.bind(this);
    this._onDrop = this._onDrop.bind(this);
  }

  componentDidMount() {
    window.addEventListener("mouseup", this._onDragLeave);
    window.addEventListener("dragenter", this._onDragEnter);
    window.addEventListener("dragover", this._onDragOver);
    this.dragBox.addEventListener("dragleave", this._onDragLeave);
    window.addEventListener("drop", this._onDrop);
  }

  componentWillUnmount() {
    window.removeEventListener("mouseup", this._onDragLeave);
    window.removeEventListener("dragenter", this._onDragEnter);
    window.addEventListener("dragover", this._onDragOver);
    this.dragBox.removeEventListener("dragleave", this._onDragLeave);
    window.removeEventListener("drop", this._onDrop);
  }

  _onDragEnter(e: Event) {
    this.setState({ visible: true });
    e.stopPropagation();
    e.preventDefault();
    return false;
  }

  _onDragOver(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }

  _onDragLeave(e: Event) {
    this.setState({ visible: false });
    e.stopPropagation();
    e.preventDefault();
    return false;
  }

  _onDrop(e: DragEvent) {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length !== 1) {
      alert("expected one file");
      return;
    }
    const file = files.item(0)!;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        this.props.onData(file.name, reader.result as ArrayBuffer);
      } catch (e) {
        alert(e);
      }
    };

    reader.readAsArrayBuffer(file);
    this.setState({ visible: false });
    return false;
  }

  render() {
    return (
      <div>
        {this.props.children}
        <div
          id="dragbox"
          style={
            !this.state.visible
              ? {
                  display: "none"
                }
              : {
                  background: "rgba(17, 109, 210, 0.5)",
                  display: "flex",
                  position: "fixed",
                  width: "100%",
                  height: "100%",
                  zIndex: 5,
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                  textAlign: "center",
                  fontSize: "30px",
                  fontWeight: 600,
                  color: "#fff",
                  letterSpacing: "1px",
                  margin: "auto",
                  fontFamily: "Roboto"
                }
          }
          ref={e => (this.dragBox = e!)}
        >
          nom nom nom
        </div>
      </div>
    );
  }
}
