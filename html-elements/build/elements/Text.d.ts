import React from 'react';
import { TextProps } from '../primitives/Text';
import { ViewProps } from '../primitives/View';
import { BlockQuoteProps, QuoteProps, TimeProps } from './Text.types';
export declare const P: React.ComponentType<TextProps>;
export declare const B: React.ComponentType<TextProps>;
export declare const S: React.ComponentType<TextProps>;
export declare const I: React.ComponentType<TextProps>;
export declare const Q: React.ComponentType<QuoteProps>;
export declare const BlockQuote: React.ComponentType<BlockQuoteProps>;
export declare const BR: React.ComponentType<TextProps>;
export declare const Mark: React.ComponentType<TextProps>;
export declare const Code: React.ComponentType<TextProps>;
declare type PreProps = TextProps | ViewProps;
export declare const Pre: React.ComponentType<PreProps>;
export declare const Time: React.ComponentType<TimeProps>;
export declare const Strong: React.ComponentType<TextProps>;
export declare const Del: React.ComponentType<TextProps>;
export declare const EM: React.ComponentType<TextProps>;
export {};
//# sourceMappingURL=Text.d.ts.map