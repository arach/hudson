import { EmbedFrame, type EmbedFrameProps } from './EmbedFrame';

export type EmbedMockProps = Omit<EmbedFrameProps, 'children'> & {
  label?: string;
};

export function EmbedMock({ label = 'EMBED · WORKSPACE', ...frame }: EmbedMockProps) {
  return (
    <EmbedFrame {...frame}>
      <div className="embed-stub">
        <span className="embed-stub__label">{label}</span>
      </div>
    </EmbedFrame>
  );
}
