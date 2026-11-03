import { fireEvent, render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";

import { TagPicker } from "./tag-picker";

const mockCreate = jest.fn();

jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({
    locale: "fr",
    t: (key: string, params?: { name?: string }) =>
      params?.name === undefined ? key : `${key}:${params.name}`,
  }),
}));
jest.mock("./tag-queries", () => ({
  useTags: () => ({
    data: [
      { id: "tag-1", name: "Courses" },
      { id: "tag-2", name: "Loisirs" },
    ],
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  }),
  useCreateTag: () => ({
    mutate: mockCreate,
    isPending: false,
    isError: false,
  }),
}));

function picker(onChange = jest.fn()) {
  return render(
    <PaperProvider>
      <TagPicker selectedIds={[]} onChange={onChange} />
    </PaperProvider>,
  );
}

const FIELD = "settings.tags.searchOrCreate";

beforeEach(() => mockCreate.mockReset());

it("narrows the row to the matches and picks one, clearing the field", async () => {
  const onChange = jest.fn();
  const view = await picker(onChange);

  await fireEvent.changeText(view.getByLabelText(FIELD), "cour");

  expect(view.queryByText("Loisirs")).toBeNull();
  // A shorter name is still a tag of its own, offered after the match.
  expect(view.getByText("settings.tags.createNamed:cour")).toBeTruthy();
  await fireEvent.press(view.getByText("Courses"));
  expect(onChange).toHaveBeenCalledWith(["tag-1"]);
  expect(view.getByLabelText(FIELD).props.value).toBe("");
});

it("offers to create a name no tag carries, then selects it and clears", async () => {
  mockCreate.mockImplementation((_name, { onSuccess }) =>
    onSuccess({ id: "tag-3", name: "Vacances" }),
  );
  const onChange = jest.fn();
  const view = await picker(onChange);

  await fireEvent.changeText(view.getByLabelText(FIELD), " Vacances ");
  await fireEvent.press(view.getByText("settings.tags.createNamed:Vacances"));

  expect(mockCreate.mock.calls[0][0]).toBe("Vacances");
  expect(onChange).toHaveBeenCalledWith(["tag-3"]);
  expect(view.getByLabelText(FIELD).props.value).toBe("");
});

it("takes the existing tag on return instead of creating a duplicate", async () => {
  const onChange = jest.fn();
  const view = await picker(onChange);

  await fireEvent.changeText(view.getByLabelText(FIELD), "loisirs");
  await fireEvent(view.getByLabelText(FIELD), "submitEditing");

  expect(mockCreate).not.toHaveBeenCalled();
  expect(onChange).toHaveBeenCalledWith(["tag-2"]);
});
