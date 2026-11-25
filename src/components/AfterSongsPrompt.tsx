import React, { useState } from "react";
import AppTestPrompt from "./AppTestPrompt";
import FeedbackPrompt, { type FeedbackPromptProps } from "./FeedbackPrompt";
import { suggestsAppTest } from "../logic/appTestPrompt";

/**
 * The card someone gets after a few songs (logic/songPrompt.ts): "How do you
 * like SingSpree?", and on Android for now the app's test instead, which
 * needs people. Once it has them, the pages can render FeedbackPrompt again.
 */
const AfterSongsPrompt = (props: FeedbackPromptProps) => {
  const [appTest] = useState(suggestsAppTest);
  return appTest ? <AppTestPrompt where={props.where} between={props.between} /> : <FeedbackPrompt {...props} />;
};

export default AfterSongsPrompt;
