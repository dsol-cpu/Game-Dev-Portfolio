import AltitudePanel from "./UI/AltitudePanel";
import SpeedControls from "./UI/SpeedControls";
import MobileControls from "./UI/MobileControls";
import ControlsInfo from "./UI/ControlsInfo";
import Compass from "./UI/Compass";
import FullscreenButton from "./FullscreenButton";

const SceneControls = (props) => {
  return (
    <>
      <AltitudePanel shipHeight={props.shipHeight} />

      {props.showControls && <SpeedControls />}
      {props.showControls && <ControlsInfo />}

      {/* <Compass rotation={props.shipRotation} /> */}

      <MobileControls
        onMove={props.handleMobileMove}
        onAltitudeUp={props.handleAltitudeUp}
        onAltitudeDown={props.handleAltitudeDown}
        onAltitudeStop={props.handleAltitudeStop}
        onOrientationReset={props.handleOrientationReset}
      />

      <FullscreenButton />
    </>
  );
};

export default SceneControls;
