import {
  createContext,
  Dispatch,
  memo,
  ReactElement,
  SetStateAction,
  useState,
} from 'react';
import Kindergarden, {
  KindergardenContext,
  Child,
  useKindergarden,
  useUpdate,
} from './Kindergarden';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

function createRegistry<RefType, Data = never>() {
  const entries: Child<RefType, Data>[] = [];
  return {
    entries,
    onAdd(child: Child<RefType, Data>) {
      entries.push(child);
    },
    onRemove(index: number) {
      entries.splice(index, 1);
    },
  };
}

describe('Kindergarden', () => {
  it('throws when child is rendered outside of Kindergarden', () => {
    const Child = () => <li ref={useKindergarden()}>Hi</li>;

    expect(() => {
      jest.spyOn(console, 'error').mockImplementationOnce(() => {});
      create(<Child />);
    }).toThrowError('Can not useKindergarden outside of <Kindergarden>');
  });

  it('does not throw when kindergarden is optional', () => {
    const Child = () => <li ref={useKindergarden({ optional: true })}>Hi</li>;

    let root: ReactTestRenderer;
    act(() => {
      expect(() => {
        root = create(<Child />);
      }).not.toThrow();
    });

    act(() => {
      root.unmount();
    });
  });

  it('hold reference to nested child', () => {
    const registry = createRegistry<ReactElement<{}, 'li'>>();
    const Child = () => <li ref={useKindergarden()}>Hi</li>;

    let root: ReactTestRenderer;
    act(() => {
      root = create(
        <Kindergarden {...registry}>
          <ul>
            <Child />
          </ul>
        </Kindergarden>,
        {
          createNodeMock: (el) => el,
        },
      );
    });

    expect(registry.entries).toEqual([
      { ref: { type: 'li', props: { children: 'Hi' } }, data: undefined },
    ]);

    act(() => {
      root.unmount();
    });

    expect(registry.entries).toEqual([]);
  });

  it('holds reference to nested children with data', () => {
    const registry = createRegistry<ReactElement<{}, 'li'>>();
    const Child = ({ children }: { children: string }) => (
      <li ref={useKindergarden({ data: children })}>{children}</li>
    );

    let root: ReactTestRenderer;
    act(() => {
      root = create(
        <Kindergarden {...registry}>
          <ul>
            <Child>Hi</Child>
          </ul>
          <ul>
            <li>
              <ul>
                <Child>Ho</Child>
              </ul>
            </li>
          </ul>
        </Kindergarden>,
        {
          createNodeMock: (el) => el,
        },
      );
    });

    expect(registry.entries).toEqual([
      { ref: { type: 'li', props: { children: 'Hi' } }, data: 'Hi' },
      { ref: { type: 'li', props: { children: 'Ho' } }, data: 'Ho' },
    ]);

    act(() => {
      root.unmount();
    });

    expect(registry.entries).toEqual([]);
  });

  it('uses custom context with typed data', () => {
    const context = createContext<KindergardenContext<
      HTMLButtonElement,
      { cool: boolean }
    > | null>(null);
    const registry = createRegistry<HTMLButtonElement, { cool: boolean }>();

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
      const wrongDataType = createRegistry<
        HTMLButtonElement,
        { cool: number }
      >();
      // @ts-expect-error
      _ = <Kindergarden {...wrongDataType} context={context} />;

      const wrongElementType = createRegistry<
        HTMLDivElement,
        { cool: boolean }
      >();
      // @ts-expect-error
      _ = <Kindergarden {...wrongElementType} context={context} />;
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
        <ul>
          <Kindergarden {...registry} context={context}>
            <Child>Hi</Child>
            <Child>Ho</Child>
          </Kindergarden>
        </ul>,
        {
          createNodeMock: (el) => el,
        },
      );
    });

    expect(registry.entries).toEqual([
      {
        ref: { type: 'button', props: { children: 'Hi' } },
        data: { cool: true },
      },
      {
        ref: { type: 'button', props: { children: 'Ho' } },
        data: { cool: true },
      },
    ]);

    act(() => {
      setCool!(false);
    });

    expect(registry.entries).toEqual([
      {
        ref: { type: 'button', props: { children: 'Hi' } },
        data: { cool: false },
      },
      {
        ref: { type: 'button', props: { children: 'Ho' } },
        data: { cool: true },
      },
    ]);

    act(() => {
      root.unmount();
    });

    expect(registry.entries).toEqual([]);
  });

  describe('events', () => {
    it('calls onAdd, onUpdate and onRemove for each child', () => {
      const addCb = jest.fn((kind) => {
        expect(kind).toEqual({
          data: expect.stringMatching(/Hi|Ho/),
          ref: null,
        });
      });
      const removeCb = jest.fn();
      const updateCb = jest.fn((i, kind) => {
        expect([0, 1]).toContain(i);
        expect(kind).toEqual({
          data: expect.any(String),
          ref: {
            props: {
              children: i === 0 ? 'Hi' : 'Ho',
            },
            type: 'li',
          },
        });
      });
      const Child = ({ children }: { children: string }) => (
        <li ref={useKindergarden({ data: children })}>{children}</li>
      );

      let root: ReactTestRenderer;
      act(() => {
        root = create(
          <Kindergarden onAdd={addCb} onRemove={removeCb} onUpdate={updateCb}>
            <ul>
              <Child>Hi</Child>
              <Child>Ho</Child>
            </ul>
          </Kindergarden>,
          {
            createNodeMock: (el) => el,
          },
        );
      });

      expect(addCb).toHaveBeenCalledTimes(2);
      expect(updateCb).toHaveBeenCalledTimes(2);
      expect(addCb.mock.calls[0][0]).toEqual({
        ref: { type: 'li', props: { children: 'Hi' } },
        data: 'Hi',
      });
      expect(addCb.mock.calls[1][0]).toEqual({
        ref: { type: 'li', props: { children: 'Ho' } },
        data: 'Ho',
      });

      expect(removeCb).not.toHaveBeenCalled();

      act(() => {
        root.unmount();
      });

      expect(addCb).toHaveBeenCalledTimes(2);
      expect(updateCb).toHaveBeenCalledTimes(2);
      expect(removeCb).toHaveBeenCalledTimes(2);
    });
  });

  describe('update', () => {
    it('throws used outside of Kindergarden', () => {
      const Child = () => {
        useUpdate([]);
        return null;
      };

      expect(() => {
        jest.spyOn(console, 'error').mockImplementationOnce(() => {});
        create(<Child />);
      }).toThrowError('Can not useUpdate outside of <Kindergarden>');
    });

    it('updates registry order when children are sorted', () => {
      const registry = createRegistry<ReactElement<{}, 'li'>>();
      const Child = memo(({ children }: { children: string }) => (
        <li ref={useKindergarden()}>{children}</li>
      ));
      let setChildren: Dispatch<SetStateAction<string[]>>;
      const Sorter = () => {
        const [texts, sc] = useState<string[]>(['Hi', 'Ho']);
        useUpdate([texts]);
        setChildren = sc;
        return (
          <ul>
            {texts.map((t) => (
              <Child key={t}>{t}</Child>
            ))}
          </ul>
        );
      };

      let root: ReactTestRenderer;
      act(() => {
        root = create(
          <Kindergarden {...registry}>
            <Sorter />
          </Kindergarden>,
          {
            createNodeMock: (el) => el,
          },
        );
      });

      expect(registry.entries).toEqual([
        {
          ref: { type: 'li', props: { children: 'Hi' } },
          data: undefined,
        },
        {
          ref: { type: 'li', props: { children: 'Ho' } },
          data: undefined,
        },
      ]);

      act(() => {
        setChildren!(['Ho', 'Hi']);
      });

      expect(root!.toJSON()).toMatchInlineSnapshot(`
        <ul>
          <li>
            Ho
          </li>
          <li>
            Hi
          </li>
        </ul>
      `);

      expect(registry.entries).toEqual([
        {
          ref: { type: 'li', props: { children: 'Ho' } },
          data: undefined,
        },
        {
          ref: { type: 'li', props: { children: 'Hi' } },
          data: undefined,
        },
      ]);

      act(() => {
        root.unmount();
      });

      expect(registry.entries).toEqual([]);
    });
  });
});
