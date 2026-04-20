type Props = {
  title?: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: "default" | "full";
};

export function VantagePageContainer({ title, description, children, maxWidth = "default" }: Props) {
  return (
    <div
      className={`mx-auto my-28 px-5 sm:px-8 md:px-10 lg:px-16 xl:px-20 2xl:px-0 ${maxWidth === "full" ? "w-full" : "max-w-[1200px]"}`}
    >
      {title && (
        <div className="mb-32 space-y-6">
          <h1 className="text-h1 mb-10">{title}</h1>
          {description && <p className="text-body-medium mt-4 text-16 text-vantage-text-secondary">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
