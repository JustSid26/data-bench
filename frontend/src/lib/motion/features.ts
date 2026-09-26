// loaded lazily by MotionProvider so the first paint does not wait on the
// animation engine; domMax adds layout / layoutId on top of domAnimation
import { domMax } from "motion/react";

export default domMax;
