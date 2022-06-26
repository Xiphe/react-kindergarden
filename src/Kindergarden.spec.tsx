import {
  createContext,
  Dispatch,
  MutableRefObject,
  SetStateAction,
  useState,
} from 'react';
import { Kind, KindergardenContext } from './Kindergarden';
import type { ReactTestRenderer } from 'react-test-renderer';
import Kindergarden, { useKindergarden } from './Kindergarden';
import { useEffect } from 'react';
import { create, act } from 'react-test-renderer';

describe('Kindergarden', () => {
  it('throws when child is rendered outside of Kindergarden', () => {
    const Child = () => <li ref={useKindergarden()}>Hi</li>;

    expect(() => {
      jest.spyOn(console, 'error').mockImplementationOnce(() => {});
      create(<Child />);
    }).toThrowError('Can not useKindergarden outside of Kindergarden context');
  });

  it('does not throw when kindergarden is optional', () => {
    const Child = () => <li ref={useKindergarden({ optional: true })}>Hi</li>;

    expect(() => {
      create(<Child />);
    }).not.toThrow();
  });

  it('hold reference to nested child', () => {
    const ref: MutableRefObject<Kind<HTMLElement>[]> = { current: [] };
    const Child = () => <li ref={useKindergarden()}>Hi</li>;

    let root: ReactTestRenderer;
    act(() => {
      root = create(
        <Kindergarden registry={ref}>
          <div>
            <Child />
          </div>
        </Kindergarden>,
        {
          createNodeMock: (el) => el,
        },
      );
    });

    expect(ref.current).toEqual([
      { $el: { type: 'li', props: { children: 'Hi' } }, data: undefined },
    ]);

    act(() => {
      root.unmount();
    });

    expect(ref.current).toEqual([]);
  });

  it('holds reference to nested children with data', () => {
    const ref: MutableRefObject<Kind<HTMLElement>[]> = { current: [] };
    const Child = ({ children }: { children: string }) => (
      <li ref={useKindergarden({ data: children })}>{children}</li>
    );

    let root: ReactTestRenderer;
    act(() => {
      root = create(
        <Kindergarden registry={ref}>
          <div>
            <Child>Hi</Child>
          </div>
          <ul>
            <li>
              <Child>Ho</Child>
            </li>
          </ul>
        </Kindergarden>,
        {
          createNodeMock: (el) => el,
        },
      );
    });

    expect(ref.current).toEqual([
      { $el: { type: 'li', props: { children: 'Hi' } }, data: 'Hi' },
      { $el: { type: 'li', props: { children: 'Ho' } }, data: 'Ho' },
    ]);

    act(() => {
      root.unmount();
    });

    expect(ref.current).toEqual([]);
  });

  it('uses custom context with typed data', () => {
    const context = createContext<KindergardenContext<
      HTMLButtonElement,
      { cool: boolean }
    > | null>(null);
    const ref: MutableRefObject<Kind<HTMLButtonElement, { cool: boolean }>[]> =
      { current: [] };

    (function tsErrors() {
      let _: any = () => {
        const ref = useKindergarden({ data: { cool: true }, context });
        // @ts-expect-error
        return <li ref={ref} />;
      };
      _ = () => {
        // @ts-expect-error
        const ref = useKindergarden({ data: { cool: 'hello' }, context });
        return <button ref={ref} />;
      };
      const wrongDataType = {} as MutableRefObject<
        Kind<HTMLButtonElement, { cool: number }>[]
      >;
      // @ts-expect-error
      _ = <Kindergarden registry={wrongDataType} context={context} />;
      const wrongElementType = {} as MutableRefObject<
        Kind<HTMLDivElement, { cool: boolean }>[]
      >;
      // @ts-expect-error
      _ = <Kindergarden registry={wrongElementType} context={context} />;
    })();

    let setCool: Dispatch<SetStateAction<boolean>> | null = null;
    const Child = ({ children }: { children: string }) => {
      const [cool, sc] = useState<boolean>(true);
      setCool = setCool || sc;
      return (
        <button ref={useKindergarden({ data: { cool }, context })}>
          {children}
        </button>
      );
    };
    let root: ReactTestRenderer;
    act(() => {
      root = create(
        <Kindergarden registry={ref} context={context}>
          <Child>Hi</Child>
          <Child>Ho</Child>
        </Kindergarden>,
        {
          createNodeMock: (el) => el,
        },
      );
    });

    expect(ref.current).toEqual([
      {
        $el: { type: 'button', props: { children: 'Hi' } },
        data: { cool: true },
      },
      {
        $el: { type: 'button', props: { children: 'Ho' } },
        data: { cool: true },
      },
    ]);

    act(() => {
      setCool!(false);
    });

    expect(ref.current).toEqual([
      {
        $el: { type: 'button', props: { children: 'Hi' } },
        data: { cool: false },
      },
      {
        $el: { type: 'button', props: { children: 'Ho' } },
        data: { cool: true },
      },
    ]);

    act(() => {
      root.unmount();
    });

    expect(ref.current).toEqual([]);
  });

  it('calls onRegister for each new child', () => {
    const ref: MutableRefObject<Kind<HTMLElement>[]> = { current: [] };
    const registerCb = jest.fn((kind) => {
      expect(kind).toEqual({
        data: expect.stringMatching(/Hi|Ho/),
        $el: null,
      });
    });
    const Child = ({ children }: { children: string }) => (
      <li ref={useKindergarden({ data: children })}>{children}</li>
    );

    let root: ReactTestRenderer;
    act(() => {
      root = create(
        <Kindergarden registry={ref} onRegister={registerCb}>
          <Child>Hi</Child>
          <Child>Ho</Child>
        </Kindergarden>,
        {
          createNodeMock: (el) => el,
        },
      );
    });

    expect(registerCb).toHaveBeenCalledTimes(2);
    expect(registerCb.mock.calls[0][0]).toEqual({
      $el: { type: 'li', props: { children: 'Hi' } },
      data: 'Hi',
    });
    expect(registerCb.mock.calls[1][0]).toEqual({
      $el: { type: 'li', props: { children: 'Ho' } },
      data: 'Ho',
    });

    act(() => {
      root.unmount();
    });

    expect(ref.current).toEqual([]);
  });
});
