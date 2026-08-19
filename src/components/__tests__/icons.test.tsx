import { render } from "@testing-library/react";

import { InfoIcon, PinIcon } from "../icons";

describe("Details toggle icons", () => {
  it.each([
    ["InfoIcon", InfoIcon],
    ["PinIcon", PinIcon],
  ])("renders %s as a 15px stroked icon", (_name, Icon) => {
    const { container } = render(<Icon />);

    expect(container.firstElementChild).toHaveAttribute("height", "15");
    expect(container.firstElementChild).toHaveAttribute("width", "15");
    expect(container.firstElementChild).toHaveAttribute("viewBox", "0 0 24 24");
    expect(container.firstElementChild).toHaveAttribute("stroke", "currentColor");
    expect(container.firstElementChild).toHaveAttribute("stroke-linecap", "round");
    expect(container.firstElementChild).toHaveAttribute("stroke-linejoin", "round");
    expect(container.firstElementChild).toHaveAttribute("stroke-width", "2");
  });

  it("renders the handoff's 10px-radius info circle", () => {
    const { container } = render(<InfoIcon />);

    expect(container.querySelector("circle")).toHaveAttribute("r", "10");
  });

  it("renders the handoff's rounded thumbtack silhouette", () => {
    const { container } = render(<PinIcon />);

    expect(container.querySelectorAll("path")).toHaveLength(2);
    expect(container.querySelectorAll("path")[1]).toHaveAttribute(
      "d",
      "M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z",
    );
  });
});
