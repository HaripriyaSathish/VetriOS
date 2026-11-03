import { SparkleIcon, HeroExtras } from "../../../components/FigmaIcons";
import LoginIllustration from "../../identity-access/components/LoginIllustration";
import { figmaImage } from "../../../assets/figmaImages";

// Blue welcome banner used across the trainee portal (VETRI OS Figma):
// eyebrow + title + subtitle on the left, cartoon on the right.
function StudentHero({ eyebrow, title, subtitle, children }) {
  const heroImage = figmaImage("hero-student");
  return (
    <section className="sd-hero">
      <span className="sd-hero-shine" aria-hidden="true" />
      <span className="sd-hero-blob blob-a" aria-hidden="true" />
      <span className="sd-hero-blob blob-b" aria-hidden="true" />
      <div className="sd-hero-text">
        <p className="sd-hero-eyebrow">
          <span className="sd-hero-line" aria-hidden="true" />
          {eyebrow}
          <SparkleIcon size={18} />
        </p>
        <h1 className="sd-hero-title sa-hero-title">{title}</h1>
        {subtitle && <p className="sd-hero-sub">{subtitle}</p>}
        {children}
      </div>
      <div className="sd-hero-art" aria-hidden="true">
        {heroImage ? (
          <img src={heroImage} alt="" />
        ) : (
          <>
            <LoginIllustration />
            <HeroExtras />
          </>
        )}
      </div>
    </section>
  );
}

export default StudentHero;
